import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { axiosBuilder } from '@data-fair/lib/node/axios.js'
import { axiosAuth } from '@data-fair/lib/node/axios-auth.js'

const directoryUrl = 'http://localhost:5600/simple-directory'
const axiosOpts = { baseURL: 'http://localhost:5600' }
const anonymous = await axiosBuilder(axiosOpts)
const superadmin = await axiosAuth({ email: 'superadmin@test.com', password: 'superpasswd', directoryUrl, adminMode: true, axiosOpts })
const dmeadus = await axiosAuth({ email: 'dmeadus0@answers.com', password: 'passwd', directoryUrl, axiosOpts })
const dmeadusOrg = await axiosAuth({ email: 'dmeadus0@answers.com', password: 'passwd', directoryUrl, org: 'KWqAGZ4mG', axiosOpts })

await test('should install a new plugin then list and remove it', async function () {
  const plugin = {
    name: '@data-fair/processing-hello-world',
    version: '0.11.0',
    distTag: 'latest',
    description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.',
    npm: 'https://www.npmjs.com/package/%40ata-fair%2F@dprocessing-hello-world'
  }
  let res = await superadmin.post('/api/v1/plugins', plugin)
  plugin.id = res.data.id
  assert.equal(res.data.name, '@data-fair/processing-hello-world')

  res = await superadmin.get('/api/v1/plugins')
  assert.equal(res.data.count, 1)
  assert.equal(res.data.results.length, 1)
  assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')

  await assert.rejects(anonymous.get('/api/v1/plugins'), (err) => err.status === 401)
  await assert.rejects(dmeadus.get('/api/v1/plugins'), (err) => err.status === 400)
  await assert.rejects(dmeadus.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG'), (err) => err.status === 403)
  res = await dmeadus.get('/api/v1/plugins?privateAccess=user:dmeadus0')
  assert.equal(res.data.results.length, 0)

  await superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: true })

  res = await dmeadus.get('/api/v1/plugins?privateAccess=user:dmeadus0')
  assert.equal(res.data.results.length, 1)
  res = await dmeadusOrg.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
  assert.equal(res.data.results.length, 1)

  await superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: false, privateAccess: [{ type: 'user', id: 'dmeadus0' }] })

  res = await dmeadus.get('/api/v1/plugins?privateAccess=user:dmeadus0')
  assert.equal(res.data.results.length, 1)
  res = await dmeadusOrg.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG')
  assert.equal(res.data.results.length, 0)

  await superadmin.delete(`/api/v1/plugins/${plugin.id}`)
  res = await superadmin.get('/api/v1/plugins')
  assert.equal(res.data.count, 0)
})
