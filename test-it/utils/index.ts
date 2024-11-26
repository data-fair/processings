import type { AxiosAuthOptions } from '@data-fair/lib-node/axios-auth.js'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { axiosAuth as _axiosAuth } from '@data-fair/lib-node/axios-auth.js'
import fs from 'fs-extra'

const directoryUrl = 'http://localhost:5600/simple-directory'

const axiosOpts = { baseURL: 'http://localhost:5600/processings' }

export const axios = (opts = {}) => axiosBuilder({ ...axiosOpts, ...opts })

export const axiosAuth = (opts: string | Omit<AxiosAuthOptions, 'directoryUrl' | 'axiosOpts' | 'password'>) => {
  opts = typeof opts === 'string' ? { email: opts } : opts
  const password = opts.email === 'superadmin@test.com' ? 'superpasswd' : 'passwd'
  const adminMode = opts.email === 'superadmin@test.com'
  return _axiosAuth({ ...opts, password, adminMode, axiosOpts, directoryUrl })
}

export const clean = async () => {
  const mongo = (await import('../../api/src/mongo.ts')).default
  for (const name of ['processings', 'runs', 'limits']) {
    await mongo.db.collection(name).deleteMany({})
  }
  await fs.emptyDir('./data/test/plugins')
}

process.env.SUPPRESS_NO_CONFIG_WARNING = '1'

export const startApiServer = async () => {
  console.log('Starting API server...')
  process.env.NODE_CONFIG_DIR = 'api/config/'
  const apiServer = await import('../../api/src/server.ts')
  await apiServer.start()
}

export const stopApiServer = async () => {
  const apiServer = await import('../../api/src/server.ts')
  await apiServer.stop()
}

export const startWorkerServer = async () => {
  console.log('Starting worker server...')
  process.env.NODE_CONFIG_DIR = 'worker/config/'
  const workerServer = await import('../../worker/src/worker.ts')
  await workerServer.start()
}

export const stopWorkerServer = async () => {
  const workerServer = await import('../../worker/src/worker.ts')
  await workerServer.stop()
}
