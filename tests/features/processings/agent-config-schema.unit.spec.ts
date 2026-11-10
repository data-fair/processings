import { test, expect } from '@playwright/test'
import { v2compat } from '@json-layout/core/compat/v2'
import { agentConfigSchema } from '../../../api/src/processings/agent-config-schema.ts'

const getItemsUrl = '{context.dataFairUrl}/api/v1/datasets?select=id,title&{context.ownerFilter}&raw=true'
const withGetItems = () => ({
  type: 'object',
  properties: { dataset: { type: 'object', layout: { getItems: { url: getItemsUrl, itemsResults: 'data.results' } } } }
})

test.describe('agent config schema', () => {
  test('context placeholders become relative urls and the owner filter', () => {
    const dep = agentConfigSchema(withGetItems(), { owner: { type: 'organization', id: 'test_org1', name: 'Test Org 1', department: 'dep1' } })
    expect(dep.properties.dataset.layout.getItems.url).toBe('/data-fair/api/v1/datasets?select=id,title&owner=organization:test_org1:dep1&raw=true')
    const noDep = agentConfigSchema(withGetItems(), { owner: { type: 'organization', id: 'test_org1', name: 'Test Org 1' } })
    expect(noDep.properties.dataset.layout.getItems.url).toBe('/data-fair/api/v1/datasets?select=id,title&owner=organization:test_org1&raw=true')
  })

  test('owner values and the directory url are substituted, other placeholders kept', () => {
    const schema = { type: 'object', properties: { a: { type: 'string', layout: { getItems: { url: '{context.directoryUrl}/api/{context.owner.type}s/{context.owner.id}/{context.owner.department}?q={q}&x={context.utcs}' } } } } }
    const out = agentConfigSchema(schema, { owner: { type: 'organization', id: 'o1', name: 'O', department: 'd1' } })
    expect(out.properties.a.layout.getItems.url).toBe('/simple-directory/api/organizations/o1/d1?q={q}&x={context.utcs}')
  })

  test('a v2 schema is converted', () => {
    const schema = {
      type: 'object',
      properties: { dataset: { type: 'object', 'x-fromUrl': '{context.dataFairUrl}/api/v1/datasets?q={q}', 'x-itemsProp': 'results', 'x-itemTitle': 'title', 'x-itemKey': 'id' } }
    }
    const out = agentConfigSchema(schema, { owner: { type: 'user', id: 'u1', name: 'U' } })
    expect(out.properties.dataset['x-fromUrl']).toBeUndefined()
    // v2compat turns the url into a js template, its ${context.x} interpolations are resolved too
    expect(out.properties.dataset.layout.getItems.url).toMatchObject({ type: 'js-tpl', expr: '/data-fair/api/v1/datasets?q={q}' })
  })

  test('a schema without placeholders is only converted, and the input is not mutated', () => {
    const schema = { type: 'object', properties: { n: { type: 'number', default: 3 }, b: { type: 'boolean', default: true }, s: { type: 'string', title: 'S' } } }
    const before = structuredClone(schema)
    const out = agentConfigSchema(schema, { owner: { type: 'user', id: 'u1', name: 'U' } })
    expect(out).toEqual(v2compat(structuredClone(schema)))
    expect(schema).toEqual(before)
  })
})
