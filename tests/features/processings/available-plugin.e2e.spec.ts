import { test, expect } from '../../fixtures/login.ts'
import { axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

/**
 * Happy-path counterpart to broken-plugin.e2e.spec.ts: a processing whose
 * plugin IS available in the registry must render its config form on the edit
 * page — and must NOT show the "plugin unavailable" banner.
 *
 * Regression guard: the edit page fetched the registry artefact through the
 * API-scoped `$fetch` (baseURL `/processings/api/v1`), so `/registry/...` was
 * rewritten to `/processings/api/v1/registry/...` → 404 → every processing
 * looked broken.
 */
test.describe('processing with available plugin — UI', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('edit page renders the config form, no broken-plugin banner', async ({ page, goToWithAuth }) => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const fixture = await publishFixturePlugin({
      name: '@data-fair/processing-hello-world',
      version: '1.2.2'
    })
    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Healthy e2e processing',
      plugin: fixture.pluginId,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
    })).data

    await goToWithAuth(`/processings/processings/${processing._id}`, 'test_superadmin')

    await expect(page.getByText('Healthy e2e processing').first()).toBeVisible({ timeout: 10000 })
    // The broken-plugin banner must NOT appear for an available plugin.
    await expect(page.getByText(/Plugin indisponible/)).toHaveCount(0)
    // The vjsf config form is rendered (v-if="processingSchema && !pluginBroken").
    await expect(page.locator('.vjsf')).toBeVisible()
  })
})
