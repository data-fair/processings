import { test, expect } from '@playwright/test'
import { axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

const installTestPlugin = async () => publishFixturePlugin({
  name: '@data-fair/processing-hello-world',
  version: '1.2.2'
})

test.describe('processing permissions', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('should create a processing and check permissions across roles', async () => {
    const plugin = await installTestPlugin()

    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
    const contribTestOrg1 = await axiosAuth({ email: 'test_contrib1@test.com', org: 'test_org1' })
    const userTestOrg1 = await axiosAuth({ email: 'test_user1@test.com', org: 'test_org1' })
    const aloneOutsider = await axiosAuth('test_alone@test.com')
    const partnerAdmin = await axiosAuth({ email: 'test_user2@test.com', org: 'test_org2' })

    const processing = (await adminTestOrg1.post('/api/v1/processings', {
      title: 'Hello processing',
      pluginId: plugin.pluginId
    })).data

    await adminTestOrg1.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing'
      },
      scheduling: [{ type: 'monthly', dayOfWeek: '*', dayOfMonth: 1, month: '*', hour: 0, minute: 0 }]
    })

    // list permission for admins and contribs in org
    expect((await adminTestOrg1.get('/api/v1/processings')).data.count).toBe(1)
    expect((await contribTestOrg1.get('/api/v1/processings')).data.count).toBe(1)
    expect((await userTestOrg1.get('/api/v1/processings')).data.count).toBe(0)

    // read permission for admins and contribs in org
    const adminProcessing = (await adminTestOrg1.get(`/api/v1/processings/${processing._id}`)).data
    expect(adminProcessing.userProfile).toBe('admin')
    const contribProcessing = (await contribTestOrg1.get(`/api/v1/processings/${processing._id}`)).data
    expect(contribProcessing.userProfile).toBe('read')
    await expect(userTestOrg1.get(`/api/v1/processings/${processing._id}`)).rejects.toMatchObject({ status: 403 })

    // read runs permission for admins and contribs in org
    const runs = (await adminTestOrg1.get('/api/v1/runs', { params: { processing: processing._id } })).data
    expect(runs.count).toBe(1)
    expect(runs.results[0].status).toBe('scheduled')
    expect((await contribTestOrg1.get('/api/v1/runs', { params: { processing: processing._id } })).data.count).toBe(1)

    // write permission only for admin
    await adminTestOrg1.patch(`/api/v1/processings/${processing._id}`, { title: 'test' })
    await expect(contribTestOrg1.patch(`/api/v1/processings/${processing._id}`, { title: 'test' })).rejects.toMatchObject({ status: 403 })
    await expect(userTestOrg1.patch(`/api/v1/processings/${processing._id}`, { title: 'test' })).rejects.toMatchObject({ status: 403 })

    // no permission at all for outsiders
    expect((await partnerAdmin.get('/api/v1/processings', { params: { owner: 'organization:test_org1' } })).data.count).toBe(0)
    expect((await aloneOutsider.get('/api/v1/processings', { params: { owner: 'organization:test_org1' } })).data.count).toBe(0)
    await expect(partnerAdmin.get(`/api/v1/processings/${processing._id}`)).rejects.toMatchObject({ status: 403 })
    await expect(aloneOutsider.get(`/api/v1/processings/${processing._id}`)).rejects.toMatchObject({ status: 403 })

    // grant permission based on user email and partner org
    await adminTestOrg1.patch(`/api/v1/processings/${processing._id}`, {
      permissions: [{
        profile: 'read',
        target: { type: 'userEmail', email: 'test_alone@test.com' }
      }, {
        profile: 'read',
        target: { type: 'partner', organization: { name: 'Test Org 2', id: 'test_org2' }, roles: ['admin'] }
      }]
    })

    expect((await partnerAdmin.get('/api/v1/processings', { params: { owner: 'organization:test_org1' } })).data.count).toBe(1)
    expect((await aloneOutsider.get('/api/v1/processings', { params: { owner: 'organization:test_org1' } })).data.count).toBe(1)
    const partnerProcessing = (await partnerAdmin.get(`/api/v1/processings/${processing._id}`)).data
    expect(partnerProcessing.userProfile).toBe('read')
    const alonePartnerProcessing = (await aloneOutsider.get(`/api/v1/processings/${processing._id}`)).data
    expect(alonePartnerProcessing.userProfile).toBe('read')
    expect((await partnerAdmin.get('/api/v1/runs', { params: { processing: processing._id, owner: 'organization:test_org1' } })).data.count).toBe(1)
    expect((await aloneOutsider.get('/api/v1/runs', { params: { processing: processing._id, owner: 'organization:test_org1' } })).data.count).toBe(1)

    // still no write permissions for the granted readers
    await expect(partnerAdmin.patch(`/api/v1/processings/${processing._id}`, { title: 'test' })).rejects.toMatchObject({ status: 403 })
    await expect(aloneOutsider.patch(`/api/v1/processings/${processing._id}`, { title: 'test' })).rejects.toMatchObject({ status: 403 })

    // plugin lifecycle is managed by registry now — no per-test deletion
  })

  test('should list processings with proper org isolation', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installTestPlugin()

    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
    const partnerAdmin = await axiosAuth({ email: 'test_user2@test.com', org: 'test_org2' })

    await adminTestOrg1.post('/api/v1/processings', {
      title: 'Hello processing 1',
      pluginId: plugin.pluginId
    })
    await partnerAdmin.post('/api/v1/processings', {
      title: 'Hello processing 2',
      pluginId: plugin.pluginId
    })

    expect((await adminTestOrg1.get('/api/v1/processings?owner=organization:test_org1')).data.count).toBe(1)
    expect((await partnerAdmin.get('/api/v1/processings?owner=organization:test_org2')).data.count).toBe(1)

    expect((await superadmin.get('/api/v1/processings?showAll=true')).data.count).toBeGreaterThanOrEqual(2)
    expect((await superadmin.get('/api/v1/processings?showAll=true&owner=organization:test_org1')).data.results.length).toBe(1)
  })

  test('should manage processings as a department admin', async () => {
    const plugin = await installTestPlugin()
    const depAdmin = await axiosAuth({ email: 'test_dep_admin@test.com', org: 'test_org1', dep: 'dep1' })

    // create a processing in his department
    const processing = (await depAdmin.post('/api/v1/processings', {
      title: 'Hello processing',
      pluginId: plugin.pluginId,
      owner: {
        id: 'test_org1',
        name: 'Test Org 1',
        type: 'organization',
        department: 'dep1',
        departmentName: 'department 1'
      }
    })).data
    expect(processing._id).toBeTruthy()

    // cannot create in another department
    await expect(depAdmin.post('/api/v1/processings', {
      title: 'Hello processing',
      pluginId: plugin.pluginId,
      owner: {
        id: 'test_org1',
        name: 'Test Org 1',
        type: 'organization',
        department: 'dep2',
        departmentName: 'department 2'
      }
    })).rejects.toMatchObject({ status: 403 })

    // cannot create in the root organization (no department)
    await expect(depAdmin.post('/api/v1/processings', {
      title: 'Hello processing',
      pluginId: plugin.pluginId,
      owner: {
        id: 'test_org1',
        name: 'Test Org 1',
        type: 'organization'
      }
    })).rejects.toMatchObject({ status: 403 })

    // cannot change owner to a different organization
    await expect(depAdmin.patch(`/api/v1/processings/${processing._id}`, {
      owner: {
        id: 'test_org2',
        name: 'Test Org 2',
        type: 'organization'
      }
    })).rejects.toMatchObject({ status: 403 })

    // can change owner to another department in the same org (admin of dep1 can move to dep2 only if also admin there)
    // here the dep_admin is only admin in dep1, so this still fails
    await expect(depAdmin.patch(`/api/v1/processings/${processing._id}`, {
      owner: {
        id: 'test_org1',
        name: 'Test Org 1',
        type: 'organization',
        department: 'dep2',
        departmentName: 'department 2'
      }
    })).rejects.toMatchObject({ status: 403 })
  })
})
