import { test, expect } from '@playwright/test'
import { anonymousAx, axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'
import { scopedOperations } from '../../../api/src/scopes.ts'

const status = { validateStatus: () => true }

test.describe('api docs', () => {
  test.afterAll(clean)

  test('the public document is origin independent and lists every scoped operation', async () => {
    const res = await anonymousAx.get('/api/v1/api-docs.json')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=300')
    expect(res.headers.vary).toContain('Accept-Language')
    const doc = res.data
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.servers[0].url).toBe('/processings/api/v1')
    expect(Object.keys(doc.components.securitySchemes).sort()).toEqual(['oauth2', 'sdCookie'])
    const flows = doc.components.securitySchemes.oauth2.flows
    for (const flow of Object.values<any>(flows)) {
      for (const url of ['tokenUrl', 'authorizationUrl', 'refreshUrl']) {
        if (flow[url]) expect(flow[url].startsWith('/simple-directory')).toBe(true)
      }
    }
    expect(JSON.stringify(doc)).not.toMatch(/localhost|feat-api-doc/)

    const operations: Record<string, { method: string, path: string, security: any[] }> = {}
    for (const [path, item] of Object.entries<any>(doc.paths)) {
      for (const [method, op] of Object.entries<any>(item)) operations[op.operationId] = { method, path, security: op.security }
    }
    expect(Object.keys(operations).sort()).toEqual(Object.keys(scopedOperations).sort())
    for (const [id, op] of Object.entries(scopedOperations)) {
      expect(operations[id]).toMatchObject({ method: op.method, path: op.path })
      expect(operations[id].security[0]).toEqual({ sdCookie: [] })
      expect(operations[id].security).toContainEqual({ oauth2: [`processings:${op.tier}`] })
    }
    expect(operations.deleteProcessing.security).not.toContainEqual({ oauth2: ['processings:write'] })

    const fr = Object.values<any>(flows)[0].scopes
    expect(fr['processings:read']).toBe('Lire les traitements du compte, leurs exécutions et leurs journaux')
    const en = Object.values<any>((await anonymousAx.get('/api/v1/api-docs.json', { headers: { 'Accept-Language': 'en' } })).data.components.securitySchemes.oauth2.flows)[0].scopes
    expect(en['processings:read']).toBe("Read the account's processings, their runs and logs")
  })

  test('the admin document is gone, the per-processing one stays', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    // unknown paths fall through to the UI's index.html: no document is served there anymore
    const removed = await superadmin.get('/api/v1/admin/api-docs.json', status)
    expect(removed.headers['content-type']).not.toContain('json')
    expect(removed.data?.openapi).toBeUndefined()
    const plugin = await publishFixturePlugin({ name: '@data-fair/processing-hello-world', version: '1.2.2' })
    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Doc processing', plugin: plugin.pluginId, owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
    })).data
    const perProcessing = await superadmin.get(`/api/v1/processings/${processing._id}/api-docs.json`)
    expect(perProcessing.status).toBe(200)
    expect(Object.keys(perProcessing.data.paths).sort()).toEqual(['/', '/_trigger', '/api-docs.json', '/webhook-key'])
  })

  test('the skill bodies are served anonymously', async () => {
    const res = await anonymousAx.get('/api/v1/agents/skills/workflow.md')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/markdown')
    expect(res.data).toMatch(/^# Setting up and following processings/)
    expect((await anonymousAx.get('/api/v1/agents/skills/unknown.md', status)).status).toBe(404)
  })
})
