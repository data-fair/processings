import path from 'node:path'
import fs from 'node:fs'
import FormData from 'form-data'
import { test, expect } from '../../fixtures/login.ts'
import { axiosAuth, clean } from '../../support/axios.ts'

test.describe('UI layout', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('authenticated user sees the processings list with empty state', async ({ page, goToWithAuth }) => {
    await goToWithAuth('/processings/processings', 'test_user1')
    await expect(page.getByText(/n'avez pas encore créé de traitement/)).toBeVisible({ timeout: 10000 })
  })

  test('processings list renders a card for an existing processing', async ({ page, goToWithAuth }) => {
    const superadmin = await axiosAuth('test_superadmin@test.com')

    const tarballPath = path.join(import.meta.dirname, '..', '..', 'fixtures', 'processing-hello-world.tgz')
    const formData = new FormData()
    formData.append('file', fs.createReadStream(tarballPath))
    const plugin = (await superadmin.post('/api/v1/plugins', formData, { headers: formData.getHeaders() })).data
    await superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: true })

    await superadmin.post('/api/v1/processings', {
      title: 'My e2e processing',
      plugin: plugin.id,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
    })

    await goToWithAuth('/processings/processings', 'test_superadmin')
    await expect(page.getByText('My e2e processing')).toBeVisible({ timeout: 10000 })
  })
})
