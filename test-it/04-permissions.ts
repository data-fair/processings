import { strict as assert } from 'node:assert'
import { it, describe, before, beforeEach, after } from 'node:test'
import { axiosAuth, clean, startApiServer, stopApiServer } from './utils/index.ts'

const superadmin = await axiosAuth('superadmin@test.com')
const cdurning2 = await axiosAuth('cdurning2@desdev.cn')
const dmeadus = await axiosAuth('dmeadus0@answers.com')
const admin1Koumoul = await axiosAuth({ email: 'admin1@test.com', org: 'koumoul' })
const contrib1Koumoul = await axiosAuth({ email: 'contrib1@test.com', org: 'koumoul' })
const user1Koumoul = await axiosAuth({ email: 'user1@test.com', org: 'koumoul' })
const dmeadusOrg = await axiosAuth({ email: 'dmeadus0@answers.com', org: 'KWqAGZ4mG' })

let plugin
const createTestPlugin = async () => {
  plugin = (await superadmin.post('/api/plugins', {
    name: '@data-fair/processing-hello-world',
    version: '0.12.2',
    distTag: 'latest',
    description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.'
  })).data
  await superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: true })
}

describe('processing', () => {
  before(startApiServer)
  beforeEach(clean)
  beforeEach(createTestPlugin)
  after(stopApiServer)

  it('should create a new processing and work on it as admin of an organization', async function () {
    // create a processing and a scheduled run
    const processing = (await admin1Koumoul.post('/api/processings', {
      title: 'Hello processing',
      plugin: plugin.id
    })).data
    assert.ok(processing._id)

    await admin1Koumoul.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing'
      },
      scheduling: [{ type: 'monthly', dayOfWeek: '*', dayOfMonth: 1, month: '*', hour: 0, minute: 0 }]
    })
    // list permission for admins and contribs in orga
    assert.equal((await admin1Koumoul.get('/api/processings')).data.count, 1)
    assert.equal((await contrib1Koumoul.get('/api/processings')).data.count, 1)
    assert.equal((await user1Koumoul.get('/api/processings')).data.count, 0)

    // read permission for admins and contribs in orga
    const admin1Processing = (await admin1Koumoul.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(admin1Processing)
    assert.equal(admin1Processing.userProfile, 'admin')
    const user1Processing = (await contrib1Koumoul.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(user1Processing)
    assert.equal(user1Processing.userProfile, 'read')
    await assert.rejects(user1Koumoul.get(`/api/v1/processings/${processing._id}`), { status: 403 })

    // read runs permission for admins and contribs in orga
    const runs = (await admin1Koumoul.get('/api/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    assert.equal(runs.results[0].status, 'scheduled')
    assert.equal((await contrib1Koumoul.get('/api/runs', { params: { processing: processing._id } })).data.count, 1)
    // await assert.rejects(user1Koumoul.get('/api/runs', { params: { processing: processing._id } }), { status: 403 })
    // write permission only for admin
    await admin1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' })
    await assert.rejects(contrib1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), { status: 403 })
    await assert.rejects(user1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), { status: 403 })

    // no permission at all for outsiders
    assert.equal((await dmeadusOrg.get('/api/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
    assert.equal((await cdurning2.get('/api/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
    await assert.rejects(dmeadusOrg.get(`/api/v1/processings/${processing._id}`), { status: 403 })
    await assert.rejects(cdurning2.get(`/api/v1/processings/${processing._id}`), { status: 403 })
    // await assert.rejects(dmeadusOrg.get('/api/runs', { params: { processing: processing._id } }), { status: 403 })
    // await assert.rejects(cdurning2.get('/api/runs', { params: { processing: processing._id } }), { status: 403 })

    // add permission based on user email and partner org
    await admin1Koumoul.patch(`/api/v1/processings/${processing._id}`, {
      permissions: [{
        profile: 'read',
        target: { type: 'userEmail', email: 'cdurning2@desdev.cn' }
      }, {
        profile: 'read',
        target: { type: 'partner', organization: { name: 'Fivechat', id: 'KWqAGZ4mG' }, roles: ['admin'] }
      }]
    })
    // list permission ok with profile "read"
    assert.equal((await dmeadusOrg.get('/api/processings', { params: { owner: 'organization:koumoul' } })).data.count, 1)
    assert.equal((await cdurning2.get('/api/processings', { params: { owner: 'organization:koumoul' } })).data.count, 1)
    assert.equal((await dmeadus.get('/api/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
    // read permission ok too
    const dmeadusOrgProcessing = (await dmeadusOrg.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(dmeadusOrgProcessing)
    assert.equal(dmeadusOrgProcessing.userProfile, 'read')
    const cdurning2Processing = (await cdurning2.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(cdurning2Processing)
    assert.equal(cdurning2Processing.userProfile, 'read')
    // read runs ok too
    assert.equal((await dmeadusOrg.get('/api/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 1)
    assert.equal((await cdurning2.get('/api/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 1)
    assert.equal((await dmeadus.get('/api/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 0)
    // permission depends on active account (simple user from partner cannot read it)
    await assert.rejects(dmeadus.get(`/api/v1/processings/${processing._id}`), { status: 403 })
    // still no write permissions
    await assert.rejects(dmeadusOrg.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), { status: 403 })
    await assert.rejects(cdurning2.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), { status: 403 })

    await superadmin.delete(`/api/v1/plugins/${plugin.id}`)
  })
})
