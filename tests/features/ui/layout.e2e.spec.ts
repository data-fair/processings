import { test, expect } from '../../fixtures/login.ts'
import { clean } from '../../support/axios.ts'

test.describe('UI layout', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('authenticated user sees the processings list with empty state', { tag: '@smoke' }, async ({ page, goToWithAuth }) => {
    await goToWithAuth('/processings/processings', 'test_user1')
    await expect(page.getByText(/n'avez pas encore créé de traitement/)).toBeVisible({ timeout: 10000 })
  })
})
