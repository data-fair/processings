import { strict as assert } from 'node:assert'
import { it, describe, before, beforeEach, after } from 'node:test'
import { axios, axiosAuth, clean, startApiServer, stopApiServer } from './utils/index.ts'

const axAno = axios()
const superadmin = await axiosAuth('superadmin@test.com')
const dmeadus = await axiosAuth('dmeadus0@answers.com')
const dmeadusOrg = await axiosAuth({ email: 'dmeadus0@answers.com', org: 'KWqAGZ4mG' })

describe('plugin', () => {
  before(startApiServer)
  beforeEach(clean)
  after(stopApiServer)

  // TODO: Decompose into 3 parts
  // Install plugin and check the file is there
  // List plugins and check the plugin is there
  // Remove the plugin and check the file is gone
  it('should install a new plugin then list and remove it', async () => {
    const plugin: { name: string; version: string; distTag: string; description: string; id?: string } = {
      name: '@data-fair/processing-hello-world',
      version: '0.12.2',
      distTag: 'latest',
      description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.'
    }
    let res = await superadmin.post('/api/v1/plugins', plugin)
    plugin.id = res.data.id
    assert.equal(res.data.name, '@data-fair/processing-hello-world')

    res = await superadmin.get('/api/v1/plugins')
    assert.equal(res.data.count, 1)
    assert.equal(res.data.results.length, 1)
    assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')

    await assert.rejects(axAno.get('/api/v1/plugins'), (err: { status: number }) => err.status === 401)
    await assert.rejects(dmeadus.get('/api/v1/plugins'), (err: { status: number }) => err.status === 400)
    await assert.rejects(dmeadus.get('/api/v1/plugins?privateAccess=organization:KWqAGZ4mG'), (err: { status: number }) => err.status === 403)
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
})
