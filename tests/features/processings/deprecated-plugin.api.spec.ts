import { test, expect } from '@playwright/test'
import { axiosAuth, clean } from '../../support/axios.ts'
import { axiosRegistryInternal, fixturePluginId, publishFixtureBranchPlugin } from '../../support/registry.ts'

// A deprecated plugin keeps running and editing the processings made from it, but no new processing is created from
// it. Its own artefact id, so that deprecating it never touches the fixture other specs use.
const DEPRECATED_PLUGIN_ID = fixturePluginId('@data-fair/processing-hello-world', 'deprecated')
const owner = { type: 'user', id: 'test_processings_superadmin', name: 'Test Super Admin' }

const setDeprecated = (deprecated: boolean) =>
  axiosRegistryInternal.patch(`/api/v1/artefacts/${encodeURIComponent(DEPRECATED_PLUGIN_ID)}`, { deprecated })

test.describe('processing — deprecated plugin', () => {
  test.beforeEach(clean)
  test.afterAll(async () => {
    await setDeprecated(false)
    await clean()
  })

  test('no new processing from a deprecated plugin, the existing ones stay usable', async () => {
    const superadmin = await axiosAuth('test_processings_superadmin@test.com')
    await publishFixtureBranchPlugin({ artefactId: DEPRECATED_PLUGIN_ID })
    await setDeprecated(false)

    const existing = (await superadmin.post('/api/v1/processings', { title: 'Before deprecation', plugin: DEPRECATED_PLUGIN_ID, owner })).data

    await setDeprecated(true)

    const refused = await superadmin.post('/api/v1/processings', { title: 'After deprecation', plugin: DEPRECATED_PLUGIN_ID, owner }, { validateStatus: () => true })
    expect(refused.status).toBe(400)
    expect(refused.data).toContain('deprecated')

    // the existing processing is still read, edited, and its plugin still answers (flagged deprecated)
    expect((await superadmin.get(`/api/v1/processings/${existing._id}`)).status).toBe(200)
    expect((await superadmin.patch(`/api/v1/processings/${existing._id}`, { title: 'Still editable' })).data.title).toBe('Still editable')
    const plugin = (await superadmin.get(`/api/v1/processings/${existing._id}/plugin`)).data
    expect(plugin.deprecated).toBe(true)
  })
})
