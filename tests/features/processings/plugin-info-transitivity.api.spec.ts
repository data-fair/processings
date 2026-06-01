import { test, expect } from '@playwright/test'
import { axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

/**
 * A user with an *individual* read permission on a processing (not via
 * ownership) must be able to read the plugin metadata even when they have no
 * personal grant on the (private) plugin. The endpoint checks the processing
 * permission against the user, then fetches the artefact from the registry on
 * behalf of the OWNER (who does have the grant).
 */
test.describe('plugin info permission transitivity', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('individually-permitted user reads plugin metadata fetched as the owner', async () => {
    // Private plugin: only test_org1 (the owner) is on privateAccess. The
    // fixture auto-grants privateAccess accounts + superadmin; test_alone has
    // NO grant of its own — that's the whole point.
    const fixture = await publishFixturePlugin({
      name: '@data-fair/processing-hello-world',
      version: '1.2.2',
      isPublic: false,
      privateAccess: [{ type: 'organization', id: 'test_org1', name: 'Test Org 1' }]
    })

    const adminTestOrg1 = await axiosAuth({ email: 'test_admin1@test.com', org: 'test_org1' })
    const aloneOutsider = await axiosAuth('test_alone@test.com')

    const processing = (await adminTestOrg1.post('/api/v1/processings', {
      title: 'Transitive plugin read',
      plugin: fixture.pluginId,
      owner: { type: 'organization', id: 'test_org1', name: 'Test Org 1' }
    })).data

    // Before the grant, the outsider cannot even see the processing.
    await expect(aloneOutsider.get(`/api/v1/processings/${processing._id}/plugin`))
      .rejects.toMatchObject({ status: 403 })

    // Grant test_alone an individual read permission on the processing.
    await adminTestOrg1.patch(`/api/v1/processings/${processing._id}`, {
      permissions: [{ profile: 'read', target: { type: 'userEmail', email: 'test_alone@test.com' } }]
    })

    // Now the outsider reads the plugin metadata — fetched as the owner.
    const res = await aloneOutsider.get(`/api/v1/processings/${processing._id}/plugin`)
    expect(res.status).toBe(200)
    expect(res.data._id).toBe(fixture.pluginId)
  })

  test('owner lacking the plugin grant gets a translated 403/404', async () => {
    // Owner test_user1 has the global access-grant but is NOT on privateAccess,
    // so the owner-scoped registry fetch is denied.
    const fixture = await publishFixturePlugin({
      name: '@data-fair/processing-hello-world',
      version: '1.2.2',
      isPublic: false,
      privateAccess: [{ type: 'organization', id: 'test_org1', name: 'Test Org 1' }],
      grants: [
        { type: 'user', id: 'test_superadmin' },
        { type: 'user', id: 'test_user1' },
        { type: 'organization', id: 'test_org1' }
      ]
    })
    const superadmin = await axiosAuth('test_superadmin@test.com')

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Owner has no access',
      plugin: fixture.pluginId,
      owner: { type: 'user', id: 'test_user1', name: 'Test User 1' }
    })).data

    const res = await superadmin.get(
      `/api/v1/processings/${processing._id}/plugin`,
      { validateStatus: () => true }
    )
    expect([403, 404]).toContain(res.status)
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    expect(body).toContain(fixture.pluginId)
  })
})
