import { test, expect } from '@playwright/test'
import { clean } from '../../support/axios.ts'
import { axiosRegistryInternal, publishFixturePlugin } from '../../support/registry.ts'

// The registry is another service: in a shared environment its database holds the artefacts and grants of every
// sub-space. The suite's clean never touches it; its fixture plugins carry its prefix and are replaced on each upload.
test.describe('registry', () => {
  test('clean leaves registry alone', async () => {
    const { pluginId } = await publishFixturePlugin({ name: '@data-fair/processing-hello-world', version: '1.2.2' })
    const artefact = async () => (await axiosRegistryInternal.get(`/api/v1/artefacts/${encodeURIComponent(pluginId)}`, { validateStatus: () => true }))
    expect((await artefact()).status).toBe(200)
    await clean()
    const after = await artefact()
    expect(after.status).toBe(200)
    expect(after.data._id).toBe(pluginId)
  })
})
