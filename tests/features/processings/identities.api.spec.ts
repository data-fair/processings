import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { axios, anonymousAx, axiosAuth, apiUrl, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

// identity webhooks are internal calls: simple-directory reaches the API directly, not through the proxy
const axIdentities = axios({ baseURL: apiUrl, headers: { 'x-secret-key': 'secret-identities' } })
const rawProcessing = async (id: string) => (await anonymousAx.get(`${apiUrl}/api/v1/test-env/raw-processing/${id}`, { validateStatus: () => true }))
const processingsDir = path.resolve(import.meta.dirname, '../../../data/development/processings')

const seedProcessing = async () => {
  const plugin = await publishFixturePlugin({ name: '@data-fair/processing-hello-world', version: '1.2.2' })
  const admin = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
  const processing = (await admin.post('/api/v1/processings', { title: 'Identities processing', plugin: plugin.pluginId })).data
  await admin.patch(`/api/v1/processings/${processing._id}`, {
    permissions: [
      { profile: 'read', target: { type: 'partner', organization: { name: 'Test Org 2', id: 'test_org2' }, roles: ['admin'] } },
      { profile: 'read', target: { type: 'partner', organization: { name: 'Test Org 3', id: 'test_org3' }, roles: ['admin'] } },
      { profile: 'read', target: { type: 'userEmail', email: 'test_alone@test.com' } }
    ]
  })
  return processing
}

test.describe('identity webhooks', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('should follow renames and the end of a partnership', async () => {
    const processing = await seedProcessing()

    await axIdentities.post('/api/identities/user/test_admin1', { name: 'Renamed Admin', organizations: [{ id: 'test_org1', role: 'admin' }] })
    let raw = (await rawProcessing(processing._id)).data
    expect(raw.created.name).toBe('Renamed Admin')
    expect(raw.updated.name).toBe('Renamed Admin')

    await axIdentities.post('/api/identities/organization/test_org2', { name: 'Renamed Org 2' })
    raw = (await rawProcessing(processing._id)).data
    expect(raw.permissions[0].target.organization.name).toBe('Renamed Org 2')

    // test_org3 is no longer a partner of the owner, the user email permission is not concerned
    await axIdentities.post('/api/identities/organization/test_org1', { name: 'Test Org 1', partners: [{ id: 'test_org2', name: 'Renamed Org 2' }] })
    raw = (await rawProcessing(processing._id)).data
    expect(raw.permissions.map((p: any) => p.target.type + ':' + (p.target.organization?.id ?? p.target.email))).toEqual(['partner:test_org2', 'userEmail:test_alone@test.com'])
  })

  test('should rename a department and forget the name of a deleted one', async () => {
    const plugin = await publishFixturePlugin({ name: '@data-fair/processing-hello-world', version: '1.2.2' })
    const depAdmin = await axiosAuth({ email: 'test_dep_admin@test.com', org: 'test_org1', dep: 'dep1' })
    const processing = (await depAdmin.post('/api/v1/processings', { title: 'Department processing', plugin: plugin.pluginId })).data
    expect(processing.owner.department).toBe('dep1')

    await axIdentities.post('/api/identities/organization/test_org1', { name: 'Test Org 1', departments: [{ id: 'dep1', name: 'Renamed Department' }] })
    let raw = (await rawProcessing(processing._id)).data
    expect(raw.owner.departmentName).toBe('Renamed Department')

    // dep1 is missing from the complete list of departments: it was deleted, only its id remains
    await axIdentities.post('/api/identities/organization/test_org1', { name: 'Test Org 1', departments: [{ id: 'dep2', name: 'Department 2' }] })
    raw = (await rawProcessing(processing._id)).data
    expect(raw.owner.department).toBe('dep1')
    expect(raw.owner.departmentName).toBeUndefined()
  })

  test('should keep only the id of a deleted user and drop a deleted partner', async () => {
    const processing = await seedProcessing()

    await axIdentities.delete('/api/identities/user/test_admin1')
    let raw = (await rawProcessing(processing._id)).data
    expect(raw.created.name).toBeUndefined()
    expect(raw.created.id).toBe('test_admin1')
    expect(raw.updated.name).toBeUndefined()

    await axIdentities.delete('/api/identities/organization/test_org2')
    raw = (await rawProcessing(processing._id)).data
    expect(raw.permissions.map((p: any) => p.target.organization?.id ?? p.target.email)).toEqual(['test_org3', 'test_alone@test.com'])
  })

  test('should delete everything a deleted organization owns, its directory included', async () => {
    const processing = await seedProcessing()
    const superadmin = await axiosAuth({ email: 'test_superadmin@test.com', adminMode: true })
    await superadmin.post('/api/v1/limits/organization/test_org1', { lastUpdate: new Date().toISOString(), processings_seconds: { limit: 100 } })
    fs.mkdirSync(path.join(processingsDir, processing._id), { recursive: true })
    fs.writeFileSync(path.join(processingsDir, processing._id, 'log.txt'), 'kept between runs')

    await axIdentities.delete('/api/identities/organization/test_org1')
    expect((await rawProcessing(processing._id)).status).toBe(404)
    expect(fs.existsSync(path.join(processingsDir, processing._id))).toBe(false)
    expect((await superadmin.get('/api/v1/limits', { params: { type: 'organization', id: 'test_org1' } })).data.results).toHaveLength(0)
  })
})
