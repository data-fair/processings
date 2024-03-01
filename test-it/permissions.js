import { strict as assert } from 'node:assert'
import { test } from 'node:test'

try {
  await test('should create a new processing and work on it as admin of an organization', async function () {
    // create a processing and a scheduled run
    const processing = (await global.ax.admin1Koumoul.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: global.pluginTest.id
    })).data
    assert.ok(processing._id)

    await global.ax.admin1Koumoul.patch(`/api/v1/processings/${processing._id}`, {
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
    assert.equal((await global.ax.admin1Koumoul.get('/api/v1/processings')).data.count, 1)
    assert.equal((await global.ax.contrib1Koumoul.get('/api/v1/processings')).data.count, 1)
    assert.equal((await global.ax.user1Koumoul.get('/api/v1/processings')).data.count, 0)

    // read permission for admins and contribs in orga
    const admin1Processing = (await global.ax.admin1Koumoul.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(admin1Processing)
    assert.equal(admin1Processing.userProfile, 'admin')
    const user1Processing = (await global.ax.contrib1Koumoul.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(user1Processing)
    assert.equal(user1Processing.userProfile, 'read')
    assert.rejects(global.ax.user1Koumoul.get(`/api/v1/processings/${processing._id}`), (err) => err.status === 403)

    // read runs permission for admins and contribs in orga
    const runs = (await global.ax.admin1Koumoul.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    assert.equal(runs.results[0].status, 'scheduled')
    assert.equal((await global.ax.contrib1Koumoul.get('/api/v1/runs', { params: { processing: processing._id } })).data.count, 1)
    // assert.rejects(user1Koumoul.get('/api/v1/runs', { params: { processing: processing._id } }), (err) => err.status === 403)
    // write permission only for admin
    assert.ok(await global.ax.admin1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }))
    assert.rejects(global.ax.contrib1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), (err) => err.status === 403)
    assert.rejects(global.ax.user1Koumoul.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), (err) => err.status === 403)

    // no permission at all for outsiders
    assert.equal((await global.ax.dmeadusOrg.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
    assert.equal((await global.ax.cdurning2.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
    assert.rejects(global.ax.dmeadusOrg.get(`/api/v1/processings/${processing._id}`), (err) => err.status === 403)
    assert.rejects(global.ax.cdurning2.get(`/api/v1/processings/${processing._id}`), (err) => err.status === 403)
    // assert.rejects(dmeadusOrg.get('/api/v1/runs', { params: { processing: processing._id } }), (err) => err.status === 403)
    // assert.rejects(cdurning2.get('/api/v1/runs', { params: { processing: processing._id } }), (err) => err.status === 403)

    // add permission based on user email and partner org
    await global.ax.admin1Koumoul.patch(`/api/v1/processings/${processing._id}`, {
      permissions: [{
        profile: 'read',
        target: { type: 'userEmail', email: 'cdurning2@desdev.cn' }
      }, {
        profile: 'read',
        target: { type: 'partner', organization: { name: 'Fivechat', id: 'KWqAGZ4mG' }, roles: ['admin'] }
      }]
    })
    // list permission ok with profile "read"
    assert.equal((await global.ax.dmeadusOrg.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 1)
    assert.equal((await global.ax.cdurning2.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 1)
    assert.equal((await global.ax.dmeadus.get('/api/v1/processings', { params: { owner: 'organization:koumoul' } })).data.count, 0)
    // read permission ok too
    const dmeadusOrgProcessing = (await global.ax.dmeadusOrg.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(dmeadusOrgProcessing)
    assert.equal(dmeadusOrgProcessing.userProfile, 'read')
    const cdurning2Processing = (await global.ax.cdurning2.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(cdurning2Processing)
    assert.equal(cdurning2Processing.userProfile, 'read')
    // read runs ok too
    assert.equal((await global.ax.dmeadusOrg.get('/api/v1/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 1)
    assert.equal((await global.ax.cdurning2.get('/api/v1/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 1)
    assert.equal((await global.ax.dmeadus.get('/api/v1/runs', { params: { processing: processing._id, owner: 'organization:koumoul' } })).data.count, 0)
    // permission depends on active account (simple user from partner cannot read it)
    assert.rejects(global.ax.dmeadus.get(`/api/v1/processings/${processing._id}`), (err) => err.status === 403)
    // still no write permissions
    assert.rejects(global.ax.dmeadusOrg.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), (err) => err.status === 403)
    assert.rejects(global.ax.cdurning2.patch(`/api/v1/processings/${processing._id}`, { title: 'test' }), (err) => err.status === 403)
  })
} finally {
  process.exit(0)
}
