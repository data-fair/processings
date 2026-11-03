import { test as setup, expect } from './fixtures/login.ts'
import { axiosAuth, clean } from './support/axios.ts'
import { publishFixturePlugin } from './support/registry.ts'

/**
 * Vite serves the UI in dev mode and transforms each route's modules on its
 * first visit, slower than the e2e timeouts on a cold start. Dependency
 * discovery is off (`optimizeDeps.noDiscovery` in ui/vite.config.ts: no page
 * reload), so this run also fails fast on a commonjs dependency missing from
 * `optimizeDeps.include` (blank page, the module named in the console).
 *
 * This project runs before the e2e ones and walks the heavy routes once.
 */
setup('Warmup heavy dev routes', async ({ page, goToWithAuth }, testInfo) => {
  const start = Date.now()
  const stamp = (label: string) => testInfo.annotations.push({ type: 'warmup', description: `${label}: ${((Date.now() - start) / 1000).toFixed(1)}s` })

  await clean()
  const superadmin = await axiosAuth('test_superadmin@test.com')
  const fixture = await publishFixturePlugin({
    name: '@data-fair/processing-hello-world',
    version: '1.2.2'
  })
  const processing = (await superadmin.post('/api/v1/processings', {
    title: 'Warmup processing',
    plugin: fixture.pluginId,
    owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
  })).data
  stamp('seeded plugin + processing')

  // 1) List route + login flow.
  await goToWithAuth('/processings/processings', 'test_superadmin')
  await expect(page.getByText('Warmup processing')).toBeVisible({ timeout: 60_000 })
  stamp('list rendered')

  // 2) Edit route: rendering the vjsf form proves the config schema compiled
  //    and pulled its form components (autocomplete, select, switch...).
  await goToWithAuth(`/processings/processings/${processing._id}`, 'test_superadmin')
  await expect(page.locator('.vjsf')).toBeVisible({ timeout: 60_000 })
  stamp('edit form rendered')

  // 3) Action menus, each mounting its own dialog card. "Exécuter" is skipped:
  // it is disabled on an inactive processing, and its card holds nothing the
  // other two don't already pull in.
  for (const label of ['Dupliquer', 'Supprimer']) {
    await page.locator('.v-list-item:not(.v-list-item--disabled)').filter({ hasText: label }).first().click()
    const cancel = page.getByRole('button', { name: /Annuler|Non/ }).first()
    await expect(cancel).toBeVisible({ timeout: 30_000 })
    // not Escape: vuetify only honors it once the overlay is flagged top of its stack, which it
    // does in a setTimeout after opening, so an early keypress is silently ignored
    await cancel.click()
    // Wait for the overlay to be gone, it would swallow the next menu click.
    await expect(page.locator('.v-overlay--active')).toHaveCount(0, { timeout: 10_000 })
  }
  stamp('action menus rendered')

  // A clean reload proves nothing is left to re-optimize: a pending Vite
  // re-optimization would reload the page again and drop the form.
  await page.reload()
  await expect(page.locator('.vjsf')).toBeVisible({ timeout: 60_000 })
  stamp('reload stable')

  await clean()
})
