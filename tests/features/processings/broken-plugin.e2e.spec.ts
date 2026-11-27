import { test, expect } from '../../fixtures/login.ts'
import { anonymousAx, apiUrl, axiosAuth, clean } from '../../support/axios.ts'
import { axiosRegistryInternal, fixturePluginId, publishFixtureBranchPlugin, publishFixturePlugin } from '../../support/registry.ts'

const setupBrokenProcessing = async () => {
  const superadmin = await axiosAuth('test_processings_superadmin@test.com')
  const fixture = await publishFixturePlugin({
    name: '@data-fair/processing-hello-world',
    version: '1.2.2'
  })
  const processing = (await superadmin.post('/api/v1/processings', {
    title: 'Broken e2e processing',
    plugin: fixture.pluginId,
    owner: { type: 'user', id: 'test_processings_superadmin', name: 'Test Super Admin' }
  })).data
  await anonymousAx.patch(
    `${apiUrl}/api/v1/test-env/raw-processing/${processing._id}`,
    { plugin: '@test-never-existed-1' }
  )
  return processing._id as string
}

test.describe('processing with unavailable plugin — UI', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('list shows the "Plugin indisponible" badge', async ({ page, goToWithAuth }) => {
    await setupBrokenProcessing()
    // the cards of the active account read the registry list once, they no longer ask for their plugin one by one
    const perCardRequests: string[] = []
    page.on('request', r => { if (/\/processings\/[^/]+\/plugin$/.test(new URL(r.url()).pathname)) perCardRequests.push(r.url()) })
    await goToWithAuth('/processings/processings', 'test_processings_superadmin')
    await expect(page.getByText('Broken e2e processing')).toBeVisible({ timeout: 10000 })
    // The card list-item renders: t('pluginUnavailable') + ' — ' + processing.plugin
    // FR locale is the test default.
    await expect(page.getByText(/Plugin indisponible/)).toBeVisible()
    expect(perCardRequests).toEqual([])
  })

  test('list and edit page flag a deprecated plugin', async ({ page, goToWithAuth }) => {
    const superadmin = await axiosAuth('test_processings_superadmin@test.com')
    const pluginId = fixturePluginId('@data-fair/processing-hello-world', 'deprecated')
    await publishFixtureBranchPlugin({ artefactId: pluginId })
    await axiosRegistryInternal.patch(`/api/v1/artefacts/${encodeURIComponent(pluginId)}`, { deprecated: false })
    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Deprecated e2e processing',
      plugin: pluginId,
      owner: { type: 'user', id: 'test_processings_superadmin', name: 'Test Super Admin' }
    })).data
    await axiosRegistryInternal.patch(`/api/v1/artefacts/${encodeURIComponent(pluginId)}`, { deprecated: true })
    try {
      await goToWithAuth('/processings/processings', 'test_processings_superadmin')
      await expect(page.getByText('Deprecated e2e processing')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/— déprécié/)).toBeVisible()
      await expect(page.getByText(/Plugin indisponible/)).toHaveCount(0)

      await goToWithAuth(`/processings/processings/${processing._id}`, 'test_processings_superadmin')
      await expect(page.getByText('Plugin déprécié')).toBeVisible({ timeout: 10000 })
    } finally {
      await axiosRegistryInternal.patch(`/api/v1/artefacts/${encodeURIComponent(pluginId)}`, { deprecated: false })
    }
  })

  test('edit page shows the banner and hides the form', async ({ page, goToWithAuth }) => {
    const id = await setupBrokenProcessing()
    await goToWithAuth(`/processings/processings/${id}`, 'test_processings_superadmin')

    // Banner present.
    await expect(page.getByText(/Plugin indisponible/).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Le plugin de ce traitement a été supprimé/)).toBeVisible()

    // vjsf is not rendered when pluginBroken=true (v-if="processingSchema && !pluginBroken").
    // Assert that no vjsf component (identified by its root class) is present.
    await expect(page.locator('.vjsf')).toHaveCount(0)

    // Delete button still present.
    await expect(page.getByText(/Supprimer/).first()).toBeVisible()
  })

  test('delete from the edit page removes the processing', async ({ page, goToWithAuth }) => {
    const id = await setupBrokenProcessing()
    await goToWithAuth(`/processings/processings/${id}`, 'test_processings_superadmin')

    // Wait for the page to fully load (banner must be visible before clicking).
    await expect(page.getByText(/Plugin indisponible/).first()).toBeVisible({ timeout: 10000 })

    await page.getByText(/Supprimer/).first().click()
    // Confirmation dialog: click the confirm button. The actions component
    // uses t('yes') for confirm — its label is "Oui" in FR.
    await page.getByRole('button', { name: /Oui/ }).click()

    // After deletion the router redirects to /processings.
    await page.waitForURL(/\/processings\/processings$/, { timeout: 10000 })

    // Verify the processing is gone via the API.
    const superadmin = await axiosAuth('test_processings_superadmin@test.com')
    const res = await superadmin.get(
      `/api/v1/processings/${id}`,
      { validateStatus: () => true }
    )
    expect(res.status).toBe(404)
  })
})
