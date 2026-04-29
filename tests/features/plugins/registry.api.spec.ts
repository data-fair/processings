import { test, expect } from '@playwright/test'
import { axios } from '../../support/axios.ts'

const axAno = axios()

test.describe('plugin-registry', () => {
  test('should search for plugins (just latest) on npmjs', async () => {
    const res = await axAno.get('/api/v1/plugins-registry', { params: { q: 'hello-world' } })
    const hwProcessingPackages = res.data.results.filter((p: { name: string }) => p.name === '@data-fair/processing-hello-world')
    expect(hwProcessingPackages.length).toBe(1)
    expect(res.data.results[0].distTag).toBe('latest')
  })

  test('should search for plugins and all their distTag versions on npmjs', async () => {
    const res = await axAno.get('/api/v1/plugins-registry', { params: { q: 'hello-world', showAll: 'true' } })
    const hwProcessingPackages = res.data.results.filter((p: { name: string }) => p.name === '@data-fair/processing-hello-world')
    expect(hwProcessingPackages.length).toBe(2)
    expect(['latest', 'test']).toContain(res.data.results[0].distTag)
    expect(['latest', 'test']).toContain(res.data.results[1].distTag)
  })
})
