import { test, expect } from '@playwright/test'
import { axiosAuth, clean, waitForRunStatus } from '../../support/axios.ts'
import { publishFixtureBranchPlugin } from '../../support/registry.ts'

// Branch refs model a mutable "dev build" of a plugin — an artefact whose id
// carries a branch-name suffix (e.g. `@data-fair-processing-hello-world-main`)
// instead of a major; tarball slots at that id are replaced on each upload.
// processing.plugin stores the id verbatim.
const BRANCH_PLUGIN_ID = '@data-fair-processing-hello-world-main'
const installBranchPlugin = async () => publishFixtureBranchPlugin({
  artefactId: BRANCH_PLUGIN_ID
})

test.describe('processing — branch ref artefact', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('runs a branch-backed processing end-to-end', async () => {
    test.slow() // a real run through the worker
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installBranchPlugin()

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Branch processing',
      plugin: plugin.pluginId,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' },
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_branch-hello-world', title: 'Branch hello world' },
        overwrite: false,
        message: 'Branch hello'
      }
    })).data
    expect(processing.plugin).toBe(BRANCH_PLUGIN_ID)

    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    const finishedRun = await waitForRunStatus(triggered._id, 'finished', 30_000)
    expect(finishedRun.status).toBe('finished')
  })
})
