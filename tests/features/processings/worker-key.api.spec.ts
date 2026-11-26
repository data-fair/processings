import { test, expect } from '@playwright/test'
import { axiosAuth as libAxiosAuth } from '@data-fair/lib-node/axios-auth.js'
import { axiosAuth, clean, directoryUrl, waitForRunStatus } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'
import { dataFairSuperadmin, dataFairUrl, workerKeyTitle } from '../../support/data-fair.ts'
import { prefix } from '../../support/sd-fixtures.ts'

const owner = { type: 'organization', id: `${prefix}org1`, name: 'Test Org 1' }

test.describe('worker key through data-fair\'s API', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('the setup created the worker key through data-fair\'s API, on the settings of the sub-space', async () => {
    // tests/state-setup.ts created it (tests/support/data-fair.ts): an admin mode key acting as any account
    const settings = (await (await dataFairSuperadmin()).get(`/settings/user/${prefix}superadmin`)).data
    const keys = settings.apiKeys.filter((k: any) => k.title === workerKeyTitle)
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatchObject({ adminMode: true, asAccount: true })
    expect(keys[0].scopes).toContain('datasets')
  })

  test('a run through the worker reaches data-fair with that key', async () => {
    test.slow()
    const admin = await axiosAuth({ email: `${prefix}admin1@test.com`, org: owner.id })
    const plugin = await publishFixturePlugin({ name: '@data-fair/processing-hello-world', version: '1.2.2' })
    const processing = (await admin.post('/api/v1/processings', { title: 'Worker key', plugin: plugin.pluginId, owner })).data
    await admin.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: { datasetMode: 'create', dataset: { id: 'test_worker-key', title: 'Worker key' }, overwrite: false, message: 'Hello worker key' }
    })
    const triggered = (await admin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    const run = await waitForRunStatus(triggered._id, ['finished', 'error'], 60_000)
    expect(run.status, JSON.stringify(run.log, null, 1)).toBe('finished')

    // the plugin created its dataset in data-fair in the name of the processing's owner, and wrote a line in it
    const datasetId = (await admin.get(`/api/v1/processings/${processing._id}`)).data.config.dataset.id
    expect(datasetId).toBeTruthy()
    expect(datasetId).not.toBe('test_worker-key')
    const dfAdmin = await libAxiosAuth({
      email: `${prefix}admin1@test.com`,
      password: 'passwd',
      org: owner.id,
      directoryUrl,
      axiosOpts: { baseURL: `${dataFairUrl}/api/v1` }
    })
    const dataset = (await dfAdmin.get(`/datasets/${datasetId}`)).data
    expect(dataset.owner).toMatchObject({ type: 'organization', id: owner.id })
    const lines = (await dfAdmin.get(`/datasets/${datasetId}/lines`)).data
    expect(lines.results.map((l: any) => l.message)).toEqual([expect.stringContaining('Hello worker key')])
    await dfAdmin.delete(`/datasets/${datasetId}`)
  })
})
