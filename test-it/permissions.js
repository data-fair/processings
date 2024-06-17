import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { axiosAuth } from '@data-fair/lib/node/axios-auth.js'

const directoryUrl = 'http://localhost:5600/simple-directory'
const axiosOpts = { baseURL: 'http://localhost:5600/processings' }
const superadmin = await axiosAuth({ email: 'superadmin@test.com', password: 'superpasswd', directoryUrl, adminMode: true, axiosOpts })
const admin1Koumoul = await axiosAuth({ email: 'admin1@test.com', password: 'passwd', directoryUrl, org: 'koumoul', axiosOpts })
const contrib1Koumoul = await axiosAuth({ email: 'contrib1@test.com', password: 'passwd', directoryUrl, org: 'koumoul', axiosOpts })
const user1Koumoul = await axiosAuth({ email: 'user1@test.com', password: 'passwd', directoryUrl, org: 'koumoul', axiosOpts })
const cdurning2 = await axiosAuth({ email: 'cdurning2@desdev.cn', password: 'passwd', directoryUrl, axiosOpts })
const dmeadus = await axiosAuth({ email: 'dmeadus0@answers.com', password: 'passwd', directoryUrl, axiosOpts })
const dmeadusOrg = await axiosAuth({ email: 'dmeadus0@answers.com', password: 'passwd', directoryUrl, org: 'KWqAGZ4mG', axiosOpts })

// create a plugin
const plugin = (await superadmin.post('/api/v1/plugins', {
  name: '@data-fair/processing-hello-world',
  version: '0.12.2',
  distTag: 'latest',
  description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.'
})).data
await superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: true })

await test('should create a new processing and work on it as admin of an organization', async function () {
  // create a processing and a scheduled run
  const processing = (await admin1Koumoul.post('/api/v1/processings', {
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
    scheduling: { type: 'monthly', dayOfWeek: '*', dayOfMonth: 1, month: '*', hour: 0, minute: 0 }
  })
  // list permission for admins and contribs in orga
  assert.equal((await admin1Koumoul.get('/api/v1/processings')).data.count, 1)
  assert.equal((await contrib1Koumoul.get('/api/v1/processings')).data.count, 1)
  assert.equal((await user1Koumoul.get('/api/v1/processings')).data.count, 0)

  // read permission for admins and contribs in orga
  const admin1Processing = (await admin1Koumoul.get(`/api/v1/processings/${processing._id}`)).data
  assert.ok(admin1Processing)
  assert.equal(admin1Processing.userProfile, 'admin')
  const user1Processing = (await contrib1Koumoul.get(`/api/v1/processings/${processing._id}`)).data
  assert.ok(user1Processing)
  assert.equal(user1Processing.userProfile, 'read')
  await assert.rejects(user1Koumoul.get(`/api/v1/processings/${processing._id}`), { status: 403 })

  // read runs permission for admins and contribs in orga
  const runs = (await admin1Koumoul.get('/api/v1/runs', { params: { processing: processing._id } })).data
  assert.equal(runs.count, 1)
  assert.equal(runs.results[0].status, 'scheduled')
  assert.equal((await contrib1Koumoul.get('/api/v1/runs', { params: { processing: processing._id } })).data.count, 1)
  // await assert.rejects(user1Koumoul.get('/api/v1/runs', { params: { processing: processing._id } }), { status: 403 })
  // write permission only for admin
  await admin1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' })
  await assert.rejects(contrib1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), { status: 403 })
  await assert.rejects(user1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), { status: 403 })

  // no permission at all for outsiders
  assert.equal((await dmeadusOrg.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
  assert.equal((await cdurning2.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
  await assert.rejects(dmeadusOrg.get(`/api/v1/processings/${processing._id}`), { status: 403 })
  await assert.rejects(cdurning2.get(`/api/v1/processings/${processing._id}`), { status: 403 })
  // await assert.rejects(dmeadusOrg.get('/api/v1/runs', { params: { processing: processing._id } }), { status: 403 })
  // await assert.rejects(cdurning2.get('/api/v1/runs', { params: { processing: processing._id } }), { status: 403 })

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
  assert.equal((await dmeadusOrg.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 1)
  assert.equal((await cdurning2.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 1)
  assert.equal((await dmeadus.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
  // read permission ok too
  const dmeadusOrgProcessing = (await dmeadusOrg.get(`/api/v1/processings/${processing._id}`)).data
  assert.ok(dmeadusOrgProcessing)
  assert.equal(dmeadusOrgProcessing.userProfile, 'read')
  const cdurning2Processing = (await cdurning2.get(`/api/v1/processings/${processing._id}`)).data
  assert.ok(cdurning2Processing)
  assert.equal(cdurning2Processing.userProfile, 'read')
  // read runs ok too
  assert.equal((await dmeadusOrg.get('/api/v1/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 1)
  assert.equal((await cdurning2.get('/api/v1/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 1)
  assert.equal((await dmeadus.get('/api/v1/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 0)
  // permission depends on active account (simple user from partner cannot read it)
  await assert.rejects(dmeadus.get(`/api/v1/processings/${processing._id}`), { status: 403 })
  // still no write permissions
  await assert.rejects(dmeadusOrg.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), { status: 403 })
  await assert.rejects(cdurning2.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), { status: 403 })

  await superadmin.delete(`/api/v1/plugins/${plugin.id}`)
})
process.exit(0)
