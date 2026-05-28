import { test, expect } from '@playwright/test'
import { axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

/**
 * A superadmin can see every artefact in the registry, so the create-form
 * picker lets them pick a plugin no matter who they set as owner. When the
 * picked plugin is private and the owner is not on `privateAccess`, the
 * registry's /:id/download route returns 403 (no longer 404, since the
 * caller already knows the id). The processings API translates that into
 * a French user-facing message and routes the response status correctly.
 *
 * The owner used here is `test_user1` because the default fixture grants only
 * include `test_superadmin` + the two orgs — a plain user account is the
 * cleanest "has a grant but no privateAccess for THIS plugin" subject.
 */
test.describe('processing creation with restricted plugin access', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('superadmin can create a processing without config even if the owner has no plugin access (broken state)', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const fixture = await publishFixturePlugin({
      name: '@data-fair/processing-hello-world',
      version: '1.2.2',
      isPublic: false,
      privateAccess: [{ type: 'organization', id: 'test_org1', name: 'Test Org 1' }],
      // Grant test_user1 the global access-grant so the only thing missing
      // is the privateAccess entry — that's the scenario we want to test.
      grants: [
        { type: 'user', id: 'test_superadmin' },
        { type: 'user', id: 'test_user1' },
        { type: 'organization', id: 'test_org1' }
      ]
    })

    const res = await superadmin.post('/api/v1/processings', {
      title: 'Owner has no access',
      plugin: fixture.pluginId,
      owner: { type: 'user', id: 'test_user1', name: 'Test User 1' }
    })
    expect(res.status).toBe(200)
    expect(res.data._id).toBeTruthy()
    expect(res.data.owner.id).toBe('test_user1')

    // The schema fetch is the first call that hits the registry on behalf of
    // the owner. Pre-rebuild registry image hides the artefact behind 404;
    // post-rebuild it returns 403 (since the caller already knows the id and
    // we want to distinguish "no access" from "doesn't exist"). Either way
    // the processings API translates to a French message containing the
    // plugin id, NOT the previous opaque 500.
    const schema = await superadmin.get(
      `/api/v1/processings/${res.data._id}/plugin-config-schema`,
      { validateStatus: () => true }
    )
    expect([403, 404]).toContain(schema.status)
    const body = typeof schema.data === 'string' ? schema.data : JSON.stringify(schema.data)
    expect(body).toContain(fixture.pluginId)
    // Post-rebuild only: the message names the owner. Skip if the registry
    // still returns 404 — that's just "Le plugin … est introuvable".
    if (schema.status === 403) expect(body).toContain('Test User 1')
  })

  test('PATCH with a config field on a processing whose owner has no access fails with 403 + message', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
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

    const created = (await superadmin.post('/api/v1/processings', {
      title: 'Owner has no access',
      plugin: fixture.pluginId,
      owner: { type: 'user', id: 'test_user1', name: 'Test User 1' }
    })).data

    const patch = await superadmin.patch(
      `/api/v1/processings/${created._id}`,
      {
        config: {
          datasetMode: 'create',
          dataset: { id: 'test_x', title: 'X' },
          overwrite: false,
          message: 'x'
        }
      },
      { validateStatus: () => true }
    )
    // 403 once the registry change deploys; 404 in the meantime (registry
    // currently hides the artefact behind 404 from the owner's view).
    expect([403, 404]).toContain(patch.status)
    const body = typeof patch.data === 'string' ? patch.data : JSON.stringify(patch.data)
    expect(body).toContain(fixture.pluginId)
    if (patch.status === 403) expect(body).toContain('Test User 1')
  })

  test('owner with privateAccess can have a processing created with config', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const fixture = await publishFixturePlugin({
      name: '@data-fair/processing-hello-world',
      version: '1.2.2',
      isPublic: false,
      privateAccess: [{ type: 'organization', id: 'test_org1', name: 'Test Org 1' }]
    })

    const res = await superadmin.post('/api/v1/processings', {
      title: 'Authorized owner with config',
      plugin: fixture.pluginId,
      owner: { type: 'organization', id: 'test_org1', name: 'Test Org 1' },
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_y', title: 'Y' },
        overwrite: false,
        message: 'y'
      }
    })
    expect(res.status).toBe(200)
    expect(res.data._id).toBeTruthy()
    expect(res.data.config?.message).toBe('y')
  })
})
