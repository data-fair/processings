import { test, expect } from '@playwright/test'
import { axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

const status = { validateStatus: () => true }
const helloConfig = {
  datasetMode: 'create',
  dataset: { id: 'test_hello-world-config', title: 'Hello world config' },
  overwrite: false,
  message: 'Hello config'
}

test.describe('processing config', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('an admin replaces and reads the config of a processing', async () => {
    const plugin = await publishFixturePlugin({ name: '@data-fair/processing-hello-world', version: '1.2.2' })
    const admin = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
    const processing = (await admin.post('/api/v1/processings', { title: 'Config processing', plugin: plugin.pluginId })).data

    expect((await admin.get(`/api/v1/processings/${processing._id}/config`)).data).toEqual({})

    const put = await admin.put(`/api/v1/processings/${processing._id}/config`, helloConfig)
    expect(put.status).toBe(200)
    expect(put.data).toEqual(helloConfig)
    expect((await admin.get(`/api/v1/processings/${processing._id}/config`)).data).toEqual(helloConfig)
    const saved = (await admin.get(`/api/v1/processings/${processing._id}`)).data
    expect(saved.config).toEqual(helloConfig)
    expect(saved.updated.date > processing.updated.date).toBe(true)

    const invalid = await admin.put(`/api/v1/processings/${processing._id}/config`, { ...helloConfig, message: 42 }, status)
    expect(invalid.status).toBe(400)
    expect((await admin.get(`/api/v1/processings/${processing._id}/config`)).data).toEqual(helloConfig)

    await admin.patch(`/api/v1/processings/${processing._id}`, {
      permissions: [{ profile: 'exec', target: { type: 'userEmail', email: 'test_alone@test.com' } }]
    })
    const executor = await axiosAuth('test_alone@test.com')
    expect((await executor.get(`/api/v1/processings/${processing._id}`)).data.userProfile).toBe('exec')
    expect((await executor.put(`/api/v1/processings/${processing._id}/config`, helloConfig, status)).status).toBe(403)
    expect((await executor.get(`/api/v1/processings/${processing._id}/config`, status)).status).toBe(403)

    expect((await admin.get('/api/v1/processings/unknown/config', status)).status).toBe(404)
    expect((await admin.put('/api/v1/processings/unknown/config', helloConfig, status)).status).toBe(404)
  })
})
