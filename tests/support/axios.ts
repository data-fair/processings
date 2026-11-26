import type { AxiosAuthOptions } from '@data-fair/lib-node/axios-auth.js'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { axiosAuth as _axiosAuth } from '@data-fair/lib-node/axios-auth.js'
import { prefix } from './sd-fixtures.ts'

/**
 * The test accounts are those of the sub-space test_processings_ (tests/support/sd-fixtures.ts), seeded in
 * simple-directory by tests/global-setup.ts and tests/state-setup.ts: password 'passwd', email `<id>@test.com`.
 * test_processings_superadmin is a simple-directory admin, logged in admin mode.
 */

export const directoryUrl = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT}/simple-directory`
export const apiUrl = `http://localhost:${process.env.DEV_API_PORT}`
export const baseURL = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT}/processings`

const axiosOpts = { baseURL }

export const axios = (opts = {}) => axiosBuilder({ ...axiosOpts, ...opts })
export const anonymousAx = axios()

export const axiosAuth = (opts: string | Omit<AxiosAuthOptions, 'directoryUrl' | 'axiosOpts' | 'password'>) => {
  opts = typeof opts === 'string' ? { email: opts } : opts
  const adminMode = opts.email === `${prefix}superadmin@test.com`
  return _axiosAuth({ ...opts, password: 'passwd', adminMode, axiosOpts, directoryUrl })
}

export const waitForWorkerIdle = async (timeoutMs = 10_000): Promise<void> => {
  const start = Date.now()
  let pending: any[] = []
  while (Date.now() - start < timeoutMs) {
    const res = await anonymousAx.get(`${apiUrl}/api/v1/test-env/pending-tasks`, { params: { prefix } })
    pending = [...res.data.triggered, ...res.data.running]
    if (pending.length === 0) return
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  // a run left over by an earlier test: name it, the culprit is the test that started it
  const list = pending.map(r => `${r.status} run ${r._id} of "${r.processing?.title}" (${r.processing?._id})`).join(', ')
  throw new Error(`worker still busy after ${timeoutMs}ms: ${list}`)
}

/**
 * Clean the test sub-space here: the processings, runs, limits and worker locks of its accounts, and the entries of
 * its own plugins (`@test_processings_…`) in the legacy plugins directory and the local registry cache, where the
 * other sub-spaces' plugins stay. Nothing in another service: the registry keeps the suite's fixture plugins
 * (`@test_processings_…`, re-uploaded by each test that needs one, removed by registry's own prefixed clean).
 */
export const clean = async () => {
  await waitForWorkerIdle()
  await anonymousAx.delete(`${apiUrl}/api/v1/test-env`, { params: { prefix } })
  await anonymousAx.delete(`${apiUrl}/api/v1/test-env/plugins`, { params: { prefix } })
  const { cleanRegistryCache } = await import('./registry.ts')
  await cleanRegistryCache()
}

/** Poll the test-env raw-run endpoint until status matches one of the given values. */
export const waitForRunStatus = async (runId: string, status: string | string[], timeoutMs = 15_000) => {
  const statuses = Array.isArray(status) ? status : [status]
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await anonymousAx.get(`${apiUrl}/api/v1/test-env/raw-run/${runId}`).catch(() => null)
    if (res && statuses.includes(res.data.status)) return res.data
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`run ${runId} did not reach status ${statuses.join('|')} within ${timeoutMs}ms`)
}
