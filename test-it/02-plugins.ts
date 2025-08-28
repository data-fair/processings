import { strict as assert } from 'node:assert'
import { it, describe, before, after } from 'node:test'
import { axios, axiosAuth, clean, startApiServer, stopApiServer } from './utils/index.ts'

const axAno = axios()
const superadmin = await axiosAuth('superadmin@test.com')
const dmeadus = await axiosAuth('dmeadus0@answers.com')
const dmeadusOrg = await axiosAuth({ email: 'dmeadus0@answers.com', org: 'KWqAGZ4mG' })

// Hello World project : https://github.com/data-fair//processing-hello-world
const plugin = {
  name: '@data-fair/processing-hello-world',
  version: '1.2.2',
  distTag: 'latest',
}
const pluginId = '@data-fair-processing-hello-world-1'

describe('plugin', () => {
  before(startApiServer)
  before(clean)
  after(clean)
  after(stopApiServer)

  it('should install a plugin from npm', async () => {
    const res = await superadmin.post('/api/v1/plugins', {
      name: plugin.name,
      version: '0.13.0', // Previous version to test update
      distTag: 'latest'
    })
    assert.equal(res.data.name, plugin.name, 'Plugin name should match')
    assert.equal(res.data.id, '@data-fair-processing-hello-world-0', 'Plugin ID should match')
    assert.equal(res.data.version, '0.13.0', 'Plugin version should match')

    // Only superadmin can install plugins
    await assert.rejects(
      dmeadusOrg.post('/api/v1/plugins'),
      (err: { status: number }) => err.status === 403,
      'Only superadmin can install plugins'
    )
  })

  it('should install a plugin from tarball', async () => {
    const FormData = (await import('form-data')).default
    const fs = await import('fs')
    const path = await import('path')

    const tarballPath = path.join(import.meta.dirname, 'utils', 'processing-hello-world.tgz')
    const formData = new FormData()
    formData.append('file', fs.createReadStream(tarballPath))

    const res = await superadmin.post('/api/v1/plugins', formData, {
      headers: formData.getHeaders()
    })

    assert.equal(res.data.name, plugin.name, 'Plugin name should match')
    assert.equal(pluginId, res.data.id, 'Plugin ID should match')
    assert.equal(res.data.version, '1.2.2', 'Plugin version should match tarball version')

    // Only superadmin can install plugins
    await assert.rejects(
      dmeadusOrg.post('/api/v1/plugins'),
      (err: { status: number }) => err.status === 403,
      'Only superadmin can install plugins'
    )
  })

  it('should update a plugin', async () => {
    const res = await superadmin.post('/api/v1/plugins', plugin)
    assert.equal(res.data.name, plugin.name, 'Plugin name should match')
    assert.equal(pluginId, res.data.id, 'Plugin ID should match')
    assert.equal(res.data.version, plugin.version, 'Plugin version should match')

    // Only superadmin can update plugins
    await assert.rejects(
      dmeadusOrg.post('/api/v1/plugins'),
      (err: { status: number }) => err.status === 403,
      'Only superadmin can update plugins'
    )
  })

  it('should list installed plugins', async () => {
    // List plugins as superadmin
    let res = await superadmin.get('/api/v1/plugins')
    assert.equal(res.data.count, 2, 'Superadmin should see the installed plugin')
    assert.equal(res.data.results.length, 2)
    assert.equal(res.data.results[0].name, plugin.name)

    // List plugins as admin (privateAccess filter is required)
    await assert.rejects(
      dmeadusOrg.get('/api/v1/plugins'),
      (err: { status: number }) => err.status === 400,
      'Admin should get error when privateAccess filter is missing'
    )

    res = await dmeadusOrg.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
    assert.equal(res.data.count, 0, 'Admin should see no plugins without access')
    assert.equal(res.data.results.length, 0)
  })

  it('should get specific plugin', async () => {
    // Get a plugin that not exists (should fail)
    await assert.rejects(
      superadmin.get('/api/v1/plugins/does-not-exist'),
      (err: { status: number }) => err.status === 404,
      'Should not find a plugin that does not exist'
    )

    // Get plugin as superadmin
    const res = await superadmin.get('/api/v1/plugins/' + pluginId)
    assert.equal(res.data.name, plugin.name, 'Superadmin should get the plugin details')
    assert.equal(res.data.id, pluginId)
    assert.equal(res.data.version, plugin.version)

    // Get plugin as admin (should fail without access)
    // await assert.rejects(
    //   dmeadusOrg.get('/api/v1/plugins/' + pluginId),
    //   (err: { status: number }) => err.status === 403,
    //   'Admin should not get the plugin details without access'
    // )
  })

  it('should manage plugin access permissions', async () => {
    // Make the plugin private with specific access to admin only
    await superadmin.put(`/api/v1/plugins/${pluginId}/access`, {
      public: false,
      privateAccess: [{ type: 'organization', id: 'KWqAGZ4mG' }]
    })

    // Admin should still see the plugin
    let res = await dmeadusOrg.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
    assert.equal(res.data.results.length, 1, 'Admin should see plugin with private access')

    // User should not see the plugin anymore
    res = await dmeadus.get('/api/v1/plugins?privateAccess=user:dmeadus0')
    assert.equal(res.data.results.length, 0, 'User should not see plugin without access')

    // Make the plugin public
    await superadmin.put(`/api/v1/plugins/${pluginId}/access`, { public: true })

    // Now admin and user should be able to see the plugin
    res = await dmeadusOrg.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
    assert.equal(res.data.results.length, 1, 'Admin should see public plugin')

    res = await dmeadus.get('/api/v1/plugins?privateAccess=user:dmeadus0')
    assert.equal(res.data.results.length, 1, 'User should see public plugin')
  })

  it('should delete a plugin', async () => {
    // Check that the plugin is installed before deletion
    let res = await superadmin.get('/api/v1/plugins')
    assert.equal(res.data.count, 2, 'There should be one plugin installed before deletion')

    // Only superadmin can delete plugins
    await assert.rejects(
      axAno.delete(`/api/v1/plugins/${pluginId}`),
      (err: { status: number }) => err.status === 401,
      'Only superadmin can delete plugins, not anonymous user'
    )
    await assert.rejects(
      dmeadusOrg.delete(`/api/v1/plugins/${pluginId}`),
      (err: { status: number }) => err.status === 403,
      'Only superadmin can delete plugins, not admin'
    )

    // Delete the plugin
    res = await superadmin.delete(`/api/v1/plugins/${pluginId}`)
    assert.equal(res.status, 204, 'Plugin should be deleted successfully when called by superadmin')

    // Check that the plugin is deleted
    await assert.rejects(
      superadmin.get('/api/v1/plugins/' + pluginId),
      (err: { status: number }) => err.status === 404,
      'Plugin is found after deletion, should not be found'
    )

    // Try to delete again (should fail)
    await assert.rejects(
      superadmin.delete(`/api/v1/plugins/${pluginId}`),
      (err: { status: number }) => err.status === 404,
      'Should not be able to delete a plugin that does not exist anymore'
    )
  })
})
