import { strict as assert } from 'node:assert'
import { test } from 'node:test'

try {
  await test('should install a new plugin then list and remove it', async function () {
    const plugin = {
      name: '@data-fair/processing-hello-world',
      version: '0.11.0',
      distTag: 'latest',
      description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.',
      npm: 'https://www.npmjs.com/package/%40ata-fair%2F@dprocessing-hello-world'
    }
    let res = await global.ax.superadmin.post('/api/v1/plugins', plugin)
    plugin.id = res.data.id
    assert.equal(res.data.name, '@data-fair/processing-hello-world')

    res = await global.ax.superadmin.get('/api/v1/plugins')
    assert.equal(res.data.count, 1)
    assert.equal(res.data.results.length, 1)
    assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')

    await assert.rejects(global.ax.anonymous.get('/api/v1/plugins'), (err) => err.status === 401)
    await assert.rejects(global.ax.dmeadusAx.get('/api/v1/plugins'), (err) => err.status === 400)
    await assert.rejects(global.ax.dmeadusAx.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG'), (err) => err.status === 403)
    res = await global.ax.dmeadusAx.get('/api/v1/plugins?privateAccess=user:dmeadus0')
    assert.equal(res.data.results.length, 0)

    await global.ax.superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: true })

    res = await global.ax.dmeadusAx.get('/api/v1/plugins?privateAccess=user:dmeadus0')
    assert.equal(res.data.results.length, 1)
    res = await global.ax.dmeadusOrgAx.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
    assert.equal(res.data.results.length, 1)

    await global.ax.superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: false, privateAccess: [{ type: 'user', id: 'dmeadus0' }] })

    res = await global.ax.dmeadusAx.get('/api/v1/plugins?privateAccess=user:dmeadus0')
    assert.equal(res.data.results.length, 1)
    res = await global.ax.dmeadusOrgAx.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
    assert.equal(res.data.results.length, 0)

    await global.ax.superadmin.delete(`/api/v1/plugins/${plugin.id}`)
    res = await global.ax.superadmin.get('/api/v1/plugins')
    assert.equal(res.data.count, 0)
  })
} finally {
  process.exit(0)
}
