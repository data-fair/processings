import { test } from 'node:test'
import childProcess from 'node:child_process'
import { strict as assert } from 'node:assert'
import { axiosAuth } from '@data-fair/lib/node/axios-auth.js'
import { axiosBuilder } from '@data-fair/lib/node/axios.js'

process.env.SUPPRESS_NO_CONFIG_WARNING = '1'
childProcess.execSync('docker compose restart -t 0 nginx')

process.env.NODE_CONFIG_DIR = 'api/config/'
const apiServer = await import('../api/src/server.js')
await apiServer.start()

const directoryUrl = 'http://localhost:5600/simple-directory'
const axiosOpts = { baseURL: 'http://localhost:5600' }
const axios = await axiosBuilder(axiosOpts)
const adminAx = await axiosAuth({ email: 'superadmin@test.com', password: 'superpasswd', directoryUrl, adminMode: true, axiosOpts })
const dmeadusAx = await axiosAuth({ email: 'dmeadus0@answers.com', password: 'passwd', directoryUrl, axiosOpts })
const dmeadusOrgAx = await axiosAuth({ email: 'dmeadus0@answers.com', password: 'passwd', directoryUrl, org: 'KWqAGZ4mG', axiosOpts })

try {
  await test('should install a new plugin then list and remove it', async function () {
    const plugin = {
      name: '@data-fair/processing-hello-world',
      version: '0.11.0',
      distTag: 'latest',
      description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.',
      npm: 'https://www.npmjs.com/package/%40ata-fair%2F@dprocessing-hello-world'
    }
    let res = await adminAx.post('/api/v1/plugins', plugin)
    plugin.id = res.data.id
    assert.equal(res.data.name, '@data-fair/processing-hello-world')

    res = await adminAx.get('/api/v1/plugins')
    assert.equal(res.data.count, 1)
    assert.equal(res.data.results.length, 1)
    assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')

    await assert.rejects(axios.get('/api/v1/plugins'), (err) => err.status === 401)
    await assert.rejects(dmeadusAx.get('/api/v1/plugins'), (err) => err.status === 400)
    await assert.rejects(dmeadusAx.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG'), (err) => err.status === 403)
    res = await dmeadusAx.get('/api/v1/plugins?privateAccess=user:dmeadus0')
    assert.equal(res.data.results.length, 0)

    await adminAx.put(`/api/v1/plugins/${plugin.id}/access`, { public: true })

    res = await dmeadusAx.get('/api/v1/plugins?privateAccess=user:dmeadus0')
    assert.equal(res.data.results.length, 1)
    res = await dmeadusOrgAx.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
    assert.equal(res.data.results.length, 1)

    await adminAx.put(`/api/v1/plugins/${plugin.id}/access`, { public: false, privateAccess: [{ type: 'user', id: 'dmeadus0' }] })

    res = await dmeadusAx.get('/api/v1/plugins?privateAccess=user:dmeadus0')
    assert.equal(res.data.results.length, 1)
    res = await dmeadusOrgAx.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
    assert.equal(res.data.results.length, 0)

    await adminAx.delete(`/api/v1/plugins/${plugin.id}`)
    res = await adminAx.get('/api/v1/plugins')
    assert.equal(res.data.count, 0)
  })
} finally {
  await apiServer.stop()
  process.exit(0)
}