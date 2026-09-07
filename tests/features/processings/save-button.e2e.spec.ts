import { test, expect } from '../../fixtures/login.ts'
import { axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

/**
 * Explicit save on the processing edit page: edits are no longer PATCHed on
 * every form change, they wait for the "Enregistrer" button in the right-hand
 * actions. Unsaved changes are protected by a leave guard.
 */
test.describe('processing edit page — explicit save', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  const setup = async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const fixture = await publishFixturePlugin({
      name: '@data-fair/processing-hello-world',
      version: '1.2.2'
    })
    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Save e2e processing',
      plugin: fixture.pluginId,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
    })).data
    return { superadmin, id: processing._id as string }
  }

  test('save button appears on edit, cancel restores, save persists', async ({ page, goToWithAuth }) => {
    const { superadmin, id } = await setup()
    await goToWithAuth(`/processings/processings/${id}`, 'test_superadmin')
    await expect(page.locator('.vjsf')).toBeVisible({ timeout: 20000 })
    // first "Titre" field is the processing title, the plugin config has one too
    const titleField = page.getByLabel('Titre', { exact: true }).first()
    await expect(titleField).toHaveValue('Save e2e processing')

    const saveBtn = page.getByRole('button', { name: 'Enregistrer' })
    const cancelBtn = page.getByRole('button', { name: 'Annuler' })
    await expect(saveBtn).toHaveCount(0)

    // Edit → save/cancel appear, nothing is PATCHed yet.
    const patches: string[] = []
    page.on('request', (req) => { if (req.method() === 'PATCH') patches.push(req.url()) })
    await titleField.fill('Renamed processing')
    await titleField.blur()
    await expect(saveBtn).toBeVisible()
    await expect(cancelBtn).toBeVisible()
    expect(patches).toHaveLength(0)
    expect((await superadmin.get(`/api/v1/processings/${id}`)).data.title).toBe('Save e2e processing')

    // Cancel restores the last saved value and hides the buttons.
    await cancelBtn.click()
    await expect(titleField).toHaveValue('Save e2e processing')
    await expect(saveBtn).toHaveCount(0)

    // Save persists the edit.
    await titleField.fill('Renamed processing')
    await titleField.blur()
    await saveBtn.click()
    await expect(saveBtn).toHaveCount(0, { timeout: 10000 })
    expect(patches).toHaveLength(1)
    expect((await superadmin.get(`/api/v1/processings/${id}`)).data.title).toBe('Renamed processing')
  })

  test('leave guard blocks navigation while there are unsaved changes', async ({ page, goToWithAuth }) => {
    const { id } = await setup()
    // Enter the edit page through the list so that going back is an in-app
    // router navigation (the breadcrumbs live in the parent frame).
    await goToWithAuth('/processings/processings', 'test_superadmin')
    await page.getByText('Save e2e processing').first().click()
    await page.waitForURL(new RegExp(`/processings/processings/${id}$`))
    await expect(page.locator('.vjsf')).toBeVisible({ timeout: 20000 })
    // first "Titre" field is the processing title, the plugin config has one too
    const titleField = page.getByLabel('Titre', { exact: true }).first()
    await expect(titleField).toHaveValue('Save e2e processing')
    await titleField.fill('Unsaved title')
    await titleField.blur()
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible()

    // A popstate commits the URL before the router guard runs, so goBack()
    // resolves before the confirm() dialog: wait for the dialog itself, then
    // assert on the settled state.
    const dialogHandled = (action: 'dismiss' | 'accept') =>
      page.waitForEvent('dialog').then(dialog => dialog[action]())

    // Refuse to leave: the router reverts to the edit page, edit intact.
    let dialog = dialogHandled('dismiss')
    await page.goBack()
    await dialog
    await expect(page).toHaveURL(new RegExp(`/processings/processings/${id}$`))
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible()
    await expect(titleField).toHaveValue('Unsaved title')

    // Accept: navigation goes through and the edit page is unmounted.
    dialog = dialogHandled('accept')
    await page.goBack()
    await dialog
    await expect(page).toHaveURL(/\/processings\/processings$/)
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0)
  })
})
