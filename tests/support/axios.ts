import type { AxiosAuthOptions } from '@data-fair/lib-node/axios-auth.js'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { axiosAuth as _axiosAuth } from '@data-fair/lib-node/axios-auth.js'

/**
 * Test users and orgs are defined in:
 *   - dev/resources/users.json — accounts test_user1, test_user2, test_contrib1,
 *     test_admin1, test_alone, test_superadmin (all use password 'passwd' except
 *     test_superadmin which uses 'superpasswd').
 *   - dev/resources/organizations.json — test_org1, test_org2 with departments and roles.
 *
 * Loaded by simple-directory (STORAGE_TYPE=file in docker-compose.yml).
 */

export const directoryUrl = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT1}/simple-directory`
export const apiUrl = `http://localhost:${process.env.DEV_API_PORT}`
export const baseURL = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT1}/processings`

const axiosOpts = { baseURL }

export const axios = (opts = {}) => axiosBuilder({ ...axiosOpts, ...opts })
export const anonymousAx = axios()

export const axiosAuth = (opts: string | Omit<AxiosAuthOptions, 'directoryUrl' | 'axiosOpts' | 'password'>) => {
  opts = typeof opts === 'string' ? { email: opts } : opts
  const isSuperadmin = opts.email === 'test_superadmin@test.com' || opts.email === 'superadmin@test.com'
  const password = isSuperadmin ? 'superpasswd' : 'passwd'
  const adminMode = isSuperadmin
  return _axiosAuth({ ...opts, password, adminMode, axiosOpts, directoryUrl })
}

export const waitForWorkerIdle = async (timeoutMs = 10_000): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await anonymousAx.get(`${apiUrl}/api/v1/test-env/pending-tasks`)
    if (res.data.triggered.length === 0 && res.data.running.length === 0) return
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`worker still has pending tasks after ${timeoutMs}ms`)
}

export const clean = async () => {
  await waitForWorkerIdle()
  await anonymousAx.delete(`${apiUrl}/api/v1/test-env`)
  await anonymousAx.delete(`${apiUrl}/api/v1/test-env/plugins`)
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
