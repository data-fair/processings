/**
 * The agent-facing surface of the API: what `@data-fair/openapi-mcp` generates from the x-agent
 * annotations of the document. `lint: 'error'` refuses a description that contradicts its schema;
 * the golden turns any change to a tool's name, description or schema into a diff a reviewer sees.
 * Regenerate with UPDATE_GOLDEN=1 when the change is intended.
 */
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { load, toolSetSnapshot, toolsForScopes } from '@data-fair/openapi-mcp'
import apiDocs from '../../../api/contract/api-docs.ts'
import { readAgentSkill } from '../../../api/contract/skills.ts'

const goldenPath = path.resolve(import.meta.dirname, '../../fixtures/agent-surface.json')
const baseUrl = 'http://localhost/processings/api/v1'

/** Serves what the API serves at /processings/api/v1/agents/skills/<name>.md */
const skillFetch = (async (input: RequestInfo | URL) => {
  const url = input instanceof Request ? input.url : String(input)
  const prefix = `${baseUrl}/agents/skills/`
  const body = url.startsWith(prefix) && url.endsWith('.md') ? readAgentSkill(url.slice(prefix.length, -3)) : undefined
  return body ? new Response(body, { headers: { 'content-type': 'text/markdown' } }) : new Response('not found', { status: 404 })
}) as typeof fetch

const editorTools = ['describeState', 'getData', 'setFieldValue', 'setData', 'getFieldSuggestions', 'editArray', 'saveForm', 'reloadForm'].map(t => `processing_config_${t}`)
const tools = ['list_processings', 'describe_processing', 'create_processing', 'update_processing', 'update_processing_permissions',
  'trigger_processing', 'list_runs', 'describe_run', 'kill_run', 'delete_processing']

test.describe('agent surface of the api docs', () => {
  test('tools load without a lint error and match the golden', async () => {
    const toolSet = await load(apiDocs('en'), { fetch: skillFetch, baseUrl, lint: 'error' })
    expect(toolSet.tools.map(t => t.name).sort()).toEqual([...tools, ...editorTools].sort())
    const workflow = toolSet.skills.find(s => s.name === 'workflow')
    expect(toolSet.skills.map(s => s.name)).toEqual(['workflow', 'processing-config'])
    expect(workflow?.error).toBeUndefined()
    expect(workflow?.body).toMatch(/^# Setting up and following processings/)
    expect(workflow!.description.length).toBeLessThanOrEqual(1024)
    // through JSON: the golden is a file, and an `enum: undefined` left by the generator is not
    const snapshot = JSON.parse(JSON.stringify(toolSetSnapshot(toolSet)))
    if (process.env.UPDATE_GOLDEN) writeFileSync(goldenPath, JSON.stringify(snapshot, null, 2) + '\n')
    expect(snapshot).toEqual(JSON.parse(readFileSync(goldenPath, 'utf8')))
  })

  test('scoped tokens are offered the tools of their tier', async () => {
    const toolSet = await load(apiDocs('en'), { fetch: skillFetch, baseUrl, lint: 'error' })
    const names = (scopes?: string[]) => toolsForScopes(toolSet, scopes).tools.map(t => t.name).sort()
    expect(names(['processings:read'])).toEqual(['describe_processing', 'describe_run', 'list_processings', 'list_runs'])
    const write = names(['processings:write'])
    expect(write).not.toContain('update_processing_permissions')
    expect(write).not.toContain('delete_processing')
    for (const t of editorTools) expect(write).toContain(t)
    expect(names(['processings:admin'])).toEqual(expect.arrayContaining(['update_processing_permissions', 'delete_processing']))
    expect(names(['datasets:read'])).toEqual([])
  })
})
