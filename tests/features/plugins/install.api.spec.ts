import { test, expect } from '@playwright/test'
import { axios, axiosAuth, clean } from '../../support/axios.ts'

const axAno = axios()

const plugin = {
  name: '@data-fair/processing-hello-world',
  version: '1.2.2',
  distTag: 'latest',
}
const pluginId = '@data-fair-processing-hello-world-1'

test.describe('plugin', () => {
  test.beforeAll(clean)
  test.afterAll(clean)

  test('should install a plugin from npm', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })

    const res = await superadmin.post('/api/v1/plugins', {
      name: plugin.name,
      version: '0.13.0', // Previous version to test update
      distTag: 'latest'
    })
    expect(res.data.name).toBe(plugin.name)
    expect(res.data.id).toBe('@data-fair-processing-hello-world-0')
    expect(res.data.version).toBe('0.13.0')

    // Only superadmin can install plugins
    await expect(adminTestOrg1.post('/api/v1/plugins')).rejects.toMatchObject({ status: 403 })
  })

  test('should install a plugin from tarball', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
    const FormData = (await import('form-data')).default
    const fs = await import('fs')
    const path = await import('path')

    const tarballPath = path.join(import.meta.dirname, '..', '..', 'fixtures', 'processing-hello-world.tgz')
    const formData = new FormData()
    formData.append('file', fs.createReadStream(tarballPath))

    const res = await superadmin.post('/api/v1/plugins', formData, {
      headers: formData.getHeaders()
    })

    expect(res.data.name).toBe(plugin.name)
    expect(res.data.id).toBe(pluginId)
    expect(res.data.version).toBe('1.2.2')

    await expect(adminTestOrg1.post('/api/v1/plugins')).rejects.toMatchObject({ status: 403 })
  })

  test('should update a plugin', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })

    const res = await superadmin.post('/api/v1/plugins', plugin)
    expect(res.data.name).toBe(plugin.name)
    expect(res.data.id).toBe(pluginId)
    expect(res.data.version).toBe(plugin.version)

    await expect(adminTestOrg1.post('/api/v1/plugins')).rejects.toMatchObject({ status: 403 })
  })

  test('should list installed plugins', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })

    let res = await superadmin.get('/api/v1/plugins')
    expect(res.data.count).toBe(2)
    expect(res.data.results.length).toBe(2)
    expect(res.data.results[0].name).toBe(plugin.name)

    await expect(adminTestOrg1.get('/api/v1/plugins')).rejects.toMatchObject({ status: 400 })

    res = await adminTestOrg1.get('/api/v1/plugins?privateAccess=organization:test_org1')
    expect(res.data.count).toBe(0)
    expect(res.data.results.length).toBe(0)
  })

  test('should get specific plugin', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')

    await expect(superadmin.get('/api/v1/plugins/does-not-exist')).rejects.toMatchObject({ status: 404 })

    const res = await superadmin.get('/api/v1/plugins/' + pluginId)
    expect(res.data.name).toBe(plugin.name)
    expect(res.data.id).toBe(pluginId)
    expect(res.data.version).toBe(plugin.version)
  })

  test('should manage plugin access permissions', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
    const aloneUser = await axiosAuth('test_alone@test.com')

    // make the plugin private with specific access to admin only
    await superadmin.put(`/api/v1/plugins/${pluginId}/access`, {
      public: false,
      privateAccess: [{ type: 'organization', id: 'test_org1' }]
    })

    let res = await adminTestOrg1.get('/api/v1/plugins?privateAccess=organization:test_org1')
    expect(res.data.results.length).toBe(1)

    res = await aloneUser.get('/api/v1/plugins?privateAccess=user:test_alone')
    expect(res.data.results.length).toBe(0)

    await superadmin.put(`/api/v1/plugins/${pluginId}/access`, { public: true })

    res = await adminTestOrg1.get('/api/v1/plugins?privateAccess=organization:test_org1')
    expect(res.data.results.length).toBe(1)

    res = await aloneUser.get('/api/v1/plugins?privateAccess=user:test_alone')
    expect(res.data.results.length).toBe(1)
  })

  test('should delete a plugin', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })

    let res = await superadmin.get('/api/v1/plugins')
    expect(res.data.count).toBe(2)

    await expect(axAno.delete(`/api/v1/plugins/${pluginId}`)).rejects.toMatchObject({ status: 401 })
    await expect(adminTestOrg1.delete(`/api/v1/plugins/${pluginId}`)).rejects.toMatchObject({ status: 403 })

    res = await superadmin.delete(`/api/v1/plugins/${pluginId}`)
    expect(res.status).toBe(204)

    await expect(superadmin.get('/api/v1/plugins/' + pluginId)).rejects.toMatchObject({ status: 404 })
    await expect(superadmin.delete(`/api/v1/plugins/${pluginId}`)).rejects.toMatchObject({ status: 404 })
  })
})
