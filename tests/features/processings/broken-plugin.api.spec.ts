import { test, expect } from '@playwright/test'
import { anonymousAx, apiUrl, axiosAuth, clean, waitForRunStatus } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

// Helper: create a processing through the normal API, then flip its
// plugin to a value that doesn't resolve in the registry via the
// dev-only test-env raw-processing PATCH endpoint.
const createBrokenProcessing = async (
  superadmin: Awaited<ReturnType<typeof axiosAuth>>
) => {
  const fixture = await publishFixturePlugin({
    name: '@data-fair/processing-hello-world',
    version: '1.2.2'
  })
  const processing = (await superadmin.post('/api/v1/processings', {
    title: 'Broken processing',
    plugin: fixture.pluginId,
    owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
  })).data
  await anonymousAx.patch(
    `${apiUrl}/api/v1/test-env/raw-processing/${processing._id}`,
    { plugin: '@test-never-existed-1' }
  )
  return processing._id as string
}

test.describe('processing with unavailable plugin', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('GET /processings/:id returns 200', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const id = await createBrokenProcessing(superadmin)

    const res = await superadmin.get(`/api/v1/processings/${id}`)
    expect(res.status).toBe(200)
    expect(res.data._id).toBe(id)
    expect(res.data.plugin).toBe('@test-never-existed-1')
  })

  test('PATCH /processings/:id with no config field succeeds even when the plugin is gone', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const id = await createBrokenProcessing(superadmin)

    // Renaming/changing scheduling on a broken-plugin processing must work —
    // ensurePluginAndReadSchema is only invoked when there's a config to
    // validate or prepare. Lets users fix metadata, switch owner, or delete.
    const res = await superadmin.patch(`/api/v1/processings/${id}`, { title: 'New title' })
    expect(res.status).toBe(200)
    expect(res.data.title).toBe('New title')
  })

  test('PATCH /processings/:id with a config field surfaces a 404 with the plugin id', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const id = await createBrokenProcessing(superadmin)

    const res = await superadmin.patch(
      `/api/v1/processings/${id}`,
      { config: { message: 'hello' } },
      { validateStatus: () => true }
    )
    expect(res.status).toBe(404)
    expect(typeof res.data === 'string' ? res.data : JSON.stringify(res.data))
      .toContain('@test-never-existed-1')
  })

  test('DELETE /processings/:id returns 204', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const id = await createBrokenProcessing(superadmin)

    const del = await superadmin.delete(`/api/v1/processings/${id}`)
    expect(del.status).toBe(204)

    // GET now 404s — the processing is gone.
    const after = await superadmin.get(
      `/api/v1/processings/${id}`,
      { validateStatus: () => true }
    )
    expect(after.status).toBe(404)
  })

  test('worker logs a friendly French message when the plugin is unavailable', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const id = await createBrokenProcessing(superadmin)

    // Activate the processing via the raw test-env endpoint to bypass the
    // registry check that would reject a normal PATCH for an unknown plugin.
    await anonymousAx.patch(
      `${apiUrl}/api/v1/test-env/raw-processing/${id}`,
      { active: true }
    )

    const triggered = (await superadmin.post(`/api/v1/processings/${id}/_trigger`)).data
    const triggeredRunId = triggered._id

    await waitForRunStatus(triggeredRunId, 'error', 30_000)

    const run = (await superadmin.get(`/api/v1/runs/${triggeredRunId}`)).data
    expect(
      run.log.some((l: any) => l.type === 'error' && l.msg.includes("n'est plus disponible"))
    ).toBe(true)
  })
})
