import { test, expect } from '@playwright/test'
import { anonymousAx, axiosAuth, clean } from '../../support/axios.ts'
import { nhiSession } from '../../support/nhi.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

const owner = { type: 'organization', id: 'test_org1', name: 'Test Org 1' }
const status = { validateStatus: () => true }

const createProcessing = async () => {
  const admin = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
  const plugin = await publishFixturePlugin({ name: '@data-fair/processing-hello-world', version: '1.2.2' })
  const processing = (await admin.post('/api/v1/processings', { title: 'Scoped processing', plugin: plugin.pluginId, owner })).data
  return { admin, plugin, processing }
}

test.describe('scopes', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('processings:read reads but does not create nor trigger', async () => {
    const { plugin, processing } = await createProcessing()
    const { bearerAx } = await nhiSession('processings:read')
    expect((await bearerAx.get('/api/v1/processings', status)).status).toBe(200)
    expect((await bearerAx.get(`/api/v1/processings/${processing._id}`, status)).status).toBe(200)
    expect((await bearerAx.get('/api/v1/runs', { ...status, params: { processing: processing._id } })).status).toBe(200)
    expect((await bearerAx.post('/api/v1/processings', { title: 'nope', plugin: plugin.pluginId, owner }, status)).status).toBe(403)
    expect((await bearerAx.post(`/api/v1/processings/${processing._id}/_trigger`, null, status)).status).toBe(403)
  })

  test('processings:write creates and patches but does not delete nor read the webhook key', async () => {
    const { plugin, processing } = await createProcessing()
    const { bearerAx } = await nhiSession('processings:write')
    expect((await bearerAx.post('/api/v1/processings', { title: 'by write', plugin: plugin.pluginId, owner }, status)).status).toBe(200)
    expect((await bearerAx.patch(`/api/v1/processings/${processing._id}`, { title: 'renamed' }, status)).status).toBe(200)
    expect((await bearerAx.delete(`/api/v1/processings/${processing._id}`, status)).status).toBe(403)
    expect((await bearerAx.get(`/api/v1/processings/${processing._id}/webhook-key`, status)).status).toBe(403)
  })

  test('processings:admin deletes', async () => {
    const { processing } = await createProcessing()
    const { bearerAx } = await nhiSession('processings:admin')
    expect((await bearerAx.delete(`/api/v1/processings/${processing._id}`, status)).status).toBe(204)
  })

  test('all:read lists processings', async () => {
    const { bearerAx } = await nhiSession('all:read')
    expect((await bearerAx.get('/api/v1/processings', status)).status).toBe(200)
  })

  test('an unrestricted NHI session deletes', async () => {
    const { processing } = await createProcessing()
    const { bearerAx } = await nhiSession()
    expect((await bearerAx.delete(`/api/v1/processings/${processing._id}`, status)).status).toBe(204)
  })

  test('the umbrella scope does not open unlisted routes', async () => {
    const { processing } = await createProcessing()
    const { bearerAx } = await nhiSession('processings')
    expect((await bearerAx.get(`/api/v1/processings/${processing._id}/api-docs.json`, status)).status).toBe(403)
    expect((await bearerAx.get('/api/v1/admin/info', status)).status).toBe(403)
  })

  test('the webhook key triggers without credentials', async () => {
    const { admin, processing } = await createProcessing()
    const key = (await admin.get(`/api/v1/processings/${processing._id}/webhook-key`)).data
    const res = await anonymousAx.post(`/api/v1/processings/${processing._id}/_trigger`, null, { ...status, params: { key } })
    expect(res.status).toBe(409)
  })

  test('unscoped cookie sessions are unchanged', async () => {
    const { admin, processing } = await createProcessing()
    expect((await admin.get(`/api/v1/processings/${processing._id}`, status)).status).toBe(200)
  })
})
