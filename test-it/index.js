import { run } from '@data-fair/lib/node/test-runner.js'
import { axiosBuilder } from '@data-fair/lib/node/axios.js'
import { axiosAuth } from '@data-fair/lib/node/axios-auth.js'
import fs from 'fs-extra'

// Before tests
process.env.SUPPRESS_NO_CONFIG_WARNING = '1'

process.env.NODE_CONFIG_DIR = 'worker/config/'
const workerServer = await import('../worker/src/server.js')
workerServer.start()

process.env.NODE_CONFIG_DIR = 'api/config/'
const apiServer = await import('../api/src/server.js')
await apiServer.start()

const directoryUrl = 'http://localhost:5600/simple-directory'
const axiosOpts = { baseURL: 'http://localhost:5600' }
global.ax = {}
global.ax.anonymous = await axiosBuilder(axiosOpts)
await Promise.all([
  axiosAuth({ email: 'superadmin@test.com', password: 'superpasswd', directoryUrl, adminMode: true, axiosOpts }).then(ax => { global.ax.superadmin = ax }),
  axiosAuth({ email: 'admin1@test.com', password: 'passwd', directoryUrl, org: 'koumoul', axiosOpts }).then(ax => { global.ax.admin1Koumoul = ax }),
  axiosAuth({ email: 'contrib1@test.com', password: 'passwd', directoryUrl, org: 'koumoul', axiosOpts }).then(ax => { global.ax.contrib1Koumoul = ax }),
  axiosAuth({ email: 'user1@test.com', password: 'passwd', directoryUrl, org: 'koumoul', axiosOpts }).then(ax => { global.ax.user1Koumoul = ax }),
  axiosAuth({ email: 'cdurning2@desdev.cn', password: 'passwd', directoryUrl, axiosOpts }).then(ax => { global.ax.cdurning2 = ax }),
  axiosAuth({ email: 'dmeadus0@answers.com', password: 'passwd', directoryUrl, axiosOpts }).then(ax => { global.ax.dmeadus = ax }),
  axiosAuth({ email: 'dmeadus0@answers.com', password: 'passwd', directoryUrl, org: 'KWqAGZ4mG', axiosOpts }).then(ax => { global.ax.dmeadusOrg = ax })
])

global.workerHook = workerServer.hook
global.pluginTest = (await global.ax.superadmin.post('/api/v1/plugins', {
  name: '@data-fair/processing-hello-world',
  version: '0.11.0',
  distTag: 'latest',
  description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.',
  npm: 'https://www.npmjs.com/package/%40data-fair%2Fprocessing-hello-world'
})).data
await global.ax.superadmin.put(`/api/v1/plugins/${global.pluginTest.id}/access`, { public: true })

// Run tests
await run('test-it')

// After tests
await fs.emptyDir('./data/test/plugins')
await fs.emptyDir('./data/test/processings')
await fs.emptyDir('./data/test/tmp')

await workerServer.stop()
await apiServer.cleanDB()
await apiServer.stop()
