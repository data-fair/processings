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

  test('creates a processing pointed at a branch ref artefact', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installBranchPlugin()
    expect(plugin.pluginId).toBe(BRANCH_PLUGIN_ID)

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Branch processing',
      plugin: plugin.pluginId,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
    })).data
    expect(processing._id).toBeTruthy()
    expect(processing.plugin).toBe(plugin.pluginId)
  })

  test('runs a branch-backed processing end-to-end', async () => {
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

    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    const finishedRun = await waitForRunStatus(triggered._id, 'finished', 30_000)
    expect(finishedRun.status).toBe('finished')
  })

  test('re-uploading the same branch ref bumps dataUpdatedAt (cache invalidation signal)', async () => {
    // The end-to-end "second run picks up the new tarball" path runs through
    // data-fair (the plugin creates a dataset on first run, mode flips to
    // update for subsequent runs). That introduces orthogonal flakiness that
    // has nothing to do with branch-ref resolution. Instead we assert the
    // contract lib-node-registry relies on: re-uploads bump `dataUpdatedAt`,
    // which is the cache key.
    await installBranchPlugin()
    const { axiosRegistryInternal } = await import('../../support/registry.ts')
    const before = (await axiosRegistryInternal.get(
      '/api/v1/artefacts/' + encodeURIComponent(BRANCH_PLUGIN_ID)
    )).data
    expect(before.format).toBe('npm')
    expect(before.dataUpdatedAt).toBeTruthy()

    // Wait long enough that the second timestamp can't tie with the first.
    await new Promise(resolve => setTimeout(resolve, 10))

    await publishFixtureBranchPlugin({ artefactId: BRANCH_PLUGIN_ID })
    const after = (await axiosRegistryInternal.get(
      '/api/v1/artefacts/' + encodeURIComponent(BRANCH_PLUGIN_ID)
    )).data
    expect(after.dataUpdatedAt).not.toBe(before.dataUpdatedAt)
    expect(new Date(after.dataUpdatedAt) > new Date(before.dataUpdatedAt)).toBe(true)
  })
})
