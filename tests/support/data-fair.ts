import { axiosAuth } from '@data-fair/lib-node/axios-auth.js'
import { anonymousAx, apiUrl, directoryUrl } from './axios.ts'
import { prefix, sdFixtures } from './sd-fixtures.ts'

/**
 * The worker runs the plugins, whose data-fair requests carry an API key in admin mode acting as the processing's
 * owner (x-account; adminMode and asAccount, which only a super admin can create). The test setup creates it through
 * data-fair's public API, as the sub-space's super admin and on its own settings (user test_processings_superadmin,
 * removed by data-fair's clean of the sub-space), then hands it to the worker through processings' test API: in
 * development the worker gives it to each run (worker/src/utils/data-fair-api-key.ts).
 * Nothing is written in data-fair's database directly.
 */

export const dataFairUrl = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT}/data-fair`
export const workerKeyTitle = 'Processings worker (tests)'
const owner = `user/${prefix}superadmin`

/** data-fair's API as the sub-space's super admin, in admin mode */
export const dataFairSuperadmin = () => axiosAuth({
  email: `${prefix}superadmin@test.com`,
  password: 'passwd',
  adminMode: true,
  directoryUrl,
  axiosOpts: { baseURL: `${dataFairUrl}/api/v1` }
})

/**
 * Create a new worker key (the previous ones of these settings are replaced) and hand it to the worker.
 * Returns the clear key.
 */
export const setupWorkerApiKey = async (): Promise<string> => {
  const superadmin = await dataFairSuperadmin()
  const res = await superadmin.patch(`/settings/${owner}`, {
    apiKeys: [{ title: workerKeyTitle, scopes: ['datasets', 'applications', 'catalogs', 'stats'], adminMode: true, asAccount: true }]
  })
  const clearKey: string | undefined = res.data.apiKeys?.find((k: any) => k.title === workerKeyTitle)?.clearKey
  if (!clearKey) throw new Error(`data-fair did not return the clear key of the worker: ${JSON.stringify(res.data.apiKeys)}`)
  await anonymousAx.put(`${apiUrl}/api/v1/test-env/data-fair-api-key`, { key: clearKey })
  return clearKey
}

/**
 * Delete the datasets the sub-space's accounts own in data-fair (the runs of the fixture plugins create some), through
 * data-fair's public API as the sub-space's super admin: data-fair's own test API is absent from its image (minimal
 * path), and what a run leaves would pile up to the owner's dataset limit (nbDatasets) over the runs.
 */
export const cleanDataFairDatasets = async (): Promise<void> => {
  const { users, organizations } = sdFixtures()
  const owners = [...users.map(u => `user:${u.id}`), ...organizations.map(o => `organization:${o.id}`)].join(',')
  const superadmin = await dataFairSuperadmin()
  for (;;) {
    const { results } = (await superadmin.get('/datasets', { params: { owner: owners, size: 100, select: 'id' } })).data
    if (!results.length) return
    for (const dataset of results) await superadmin.delete(`/datasets/${dataset.id}`)
  }
}
