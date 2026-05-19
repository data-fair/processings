import { test, expect } from '@playwright/test'
import { axiosAuth, clean, waitForRunStatus } from '../../support/axios.ts'
import { publishFixtureBranchPlugin } from '../../support/registry.ts'

// Branch artefacts model a mutable, version-less "dev build" of a plugin.
// processing.pluginId for a branch-backed processing is just the artefact
// id with no `@major` suffix.
const installBranchPlugin = async () => publishFixtureBranchPlugin({
  artefactId: '@data-fair/processing-hello-world-main',
  branchName: 'main'
})

test.describe('processing — branch artefact', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('creates a processing pointed at a branch artefact (no @major)', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installBranchPlugin()
    expect(plugin.pluginId).toBe('@data-fair/processing-hello-world-main')
    expect(plugin.pluginId.includes('@', 1)).toBe(false)

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Branch processing',
      pluginId: plugin.pluginId,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
    })).data
    expect(processing._id).toBeTruthy()
    expect(processing.pluginId).toBe(plugin.pluginId)
  })

  test('runs a branch-backed processing end-to-end', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installBranchPlugin()

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Branch processing',
      pluginId: plugin.pluginId,
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

  test('re-uploading the same branch artefact bumps dataUpdatedAt (cache invalidation signal)', async () => {
    // The end-to-end "second run picks up the new tarball" path runs through
    // data-fair (the plugin creates a dataset on first run, mode flips to
    // update for subsequent runs). That introduces orthogonal flakiness that
    // has nothing to do with branch-artefact resolution. Instead we assert
    // the contract `ensureBranchArtefact` relies on: re-uploads change
    // `dataUpdatedAt`, which is the cache key.
    await installBranchPlugin()
    const { axiosRegistryInternal } = await import('../../support/registry.ts')
    const before = (await axiosRegistryInternal.get(
      '/api/v1/artefacts/' + encodeURIComponent('@data-fair/processing-hello-world-main')
    )).data
    expect(before.format).toBe('branch')
    expect(before.dataUpdatedAt).toBeTruthy()

    // Wait long enough that the second timestamp can't tie with the first.
    await new Promise(resolve => setTimeout(resolve, 10))

    await publishFixtureBranchPlugin({
      artefactId: '@data-fair/processing-hello-world-main',
      branchName: 'main'
    })
    const after = (await axiosRegistryInternal.get(
      '/api/v1/artefacts/' + encodeURIComponent('@data-fair/processing-hello-world-main')
    )).data
    expect(after.dataUpdatedAt).not.toBe(before.dataUpdatedAt)
    expect(new Date(after.dataUpdatedAt) > new Date(before.dataUpdatedAt)).toBe(true)
  })
})
