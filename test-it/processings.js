import { axiosAuth } from '@data-fair/lib/node/axios-auth.js'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import fs from 'fs-extra'

process.env.SUPPRESS_NO_CONFIG_WARNING = '1'

process.env.NODE_CONFIG_DIR = 'worker/config/'
const workerServer = await import('../worker/src/server.js')
workerServer.start()

process.env.NODE_CONFIG_DIR = 'api/config/'
const apiServer = await import('../api/src/server.js')
await apiServer.start()
await apiServer.cleanDB()

// For tasks that need to be run in the worker
process.env.NODE_CONFIG_DIR = 'worker/config/'

const directoryUrl = 'http://localhost:5600/simple-directory'
const axiosOpts = { baseURL: 'http://localhost:5600' }
const adminAx = await axiosAuth({ email: 'superadmin@test.com', password: 'superpasswd', directoryUrl, adminMode: true, axiosOpts })

const plugin = (await adminAx.post('/api/v1/plugins', {
  name: '@data-fair/processing-hello-world',
  version: '0.11.0',
  distTag: 'latest',
  description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.',
  npm: 'https://www.npmjs.com/package/%40data-fair%2Fprocessing-hello-world'
})).data

try {
  await test('should create a new processing, activate it and run it', async function () {
    let processing = (await adminAx.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id
    })).data
    assert.ok(processing._id)
    assert.equal(processing.scheduling.type, 'trigger')
    assert.ok(!processing.webhookKey)

    const processings = (await adminAx.get('/api/v1/processings')).data
    assert.equal(processings.count, 1)
    assert.equal(processings.results[0]._id, processing._id)
    assert.ok(!processings.results[0].webhookKey)

    // no run at first
    let runs = (await adminAx.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 0)

    // active but without scheduling = still no run
    await adminAx.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing'
      }
    })
    runs = (await adminAx.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 0)

    // active and with scheduling = a scheduled run
    await adminAx.patch(`/api/v1/processings/${processing._id}`, {
      scheduling: { type: 'monthly', dayOfWeek: '*', dayOfMonth: 1, month: '*', hour: 0, minute: 0 }
    })
    runs = (await adminAx.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    assert.equal(runs.results[0].status, 'scheduled')

    await adminAx.patch(`/api/v1/processings/${processing._id}`, { scheduling: { type: 'trigger' } })
    await adminAx.post(`/api/v1/processings/${processing._id}/_trigger`)
    runs = (await adminAx.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    assert.equal(runs.results[0].status, 'triggered')

    // nothing, failure is normal we have no api key
    // const notif = await event2promise(global.events, 'notification')
    // assert.equal(notif.topic.key, `processings:processing-finish-error:${processing._id}`)
    await assert.rejects(workerServer.hook(processing._id), () => true)

    const run = (await adminAx.get('/api/v1/runs/' + runs.results[0]._id)).data
    assert.equal(run.status, 'error')
    assert.equal(run.log[0].type, 'step')
    assert.equal(run.log[1].type, 'error')

    processing = (await adminAx.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(processing.lastRun)
    assert.equal(processing.lastRun.status, 'error')
    assert.ok(!processing.webhookKey)
  })

  // await test('should kill a long run with SIGTERM', async function () {
  //   const processing = (await adminAx.post('/api/v1/processings', {
  //     title: 'Hello processing',
  //     plugin: plugin.id,
  //     active: true,
  //     config: {
  //       datasetMode: 'create',
  //       dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
  //       message: 'Hello world test processing long',
  //       delay: 4
  //     }
  //   })).data

  //   await adminAx.post(`/api/v1/processings/${processing._id}/_trigger`)
  //   const runs = (await adminAx.get('/api/v1/runs', { params: { processing: processing._id } })).data
  //   assert.equal(runs.count, 1)
  //   let run = runs.results[0]
  //   assert.equal(run.status, 'triggered')
  //   await new Promise(resolve => setTimeout(resolve, 1000))
  //   await adminAx.post(`/api/v1/runs/${run._id}/_kill`)
  //   run = (await adminAx.get(`/api/v1/runs/${run._id}`)).data
  //   assert.equal(run.status, 'kill')
  //   await workerServer.hook(processing._id)
  //   run = (await adminAx.get(`/api/v1/runs/${run._id}`)).data
  //   assert.equal(run.status, 'killed')
  //   assert.equal(run.log.length, 4)

  //   // limits were updated
  //   const limits = (await adminAx.get('/api/v1/limits/user/superadmin')).data
  //   assert.ok(limits.processings_seconds.consumption >= 1)
  //   assert.equal(limits.processings_seconds.limit, -1)
  // })

  // await test('should kill a long run with SIGTERM and wait for grace period', async function () {
  //   const processing = (await adminAx.post('/api/v1/processings', {
  //     title: 'Hello processing',
  //     plugin: plugin.id,
  //     active: true,
  //     config: {
  //       datasetMode: 'create',
  //       dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
  //       message: 'Hello world test processing long',
  //       delay: 10000,
  //       ignoreStop: true
  //     }
  //   })).data

  //   await adminAx.post(`/api/v1/processings/${processing._id}/_trigger`)
  //   const runs = (await adminAx.get('/api/v1/runs', { params: { processing: processing._id } })).data
  //   assert.equal(runs.count, 1)
  //   let run = runs.results[0]
  //   assert.equal(run.status, 'triggered')
  //   await new Promise(resolve => setTimeout(resolve, 1000))
  //   await adminAx.post(`/api/v1/runs/${run._id}/_kill`)
  //   run = (await adminAx.get(`/api/v1/runs/${run._id}`)).data
  //   assert.equal(run.status, 'kill')
  //   await workerServer.hook(processing._id)
  //   run = (await adminAx.get(`/api/v1/runs/${run._id}`)).data
  //   assert.equal(run.status, 'killed')
  //   assert.equal(run.log.length, 2)
  // })

  await test('should fail a run if processings_seconds limit is exceeded', async function () {
    await adminAx.post('/api/v1/limits/user/superadmin', {
      processings_seconds: { limit: 1 },
      lastUpdate: new Date().toISOString()
    })

    const processing = (await adminAx.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        message: 'Hello world test processing long',
        delay: 1,
        ignoreStop: true
      }
    })).data

    await adminAx.post(`/api/v1/processings/${processing._id}/_trigger`)
    await assert.rejects(workerServer.hook(processing._id), () => true)

    let limits = (await adminAx.get('/api/v1/limits/user/superadmin')).data
    const consumption = limits.processings_seconds.consumption
    assert.ok(consumption >= 1)

    await adminAx.post(`/api/v1/processings/${processing._id}/_trigger`)
    await assert.rejects(workerServer.hook(processing._id), (err) => {
      assert.equal(err.message, 'le temps de traitement autorisé est épuisé')
      return true
    })
    limits = (await adminAx.get('/api/v1/limits/user/superadmin')).data
    assert.equal(limits.processings_seconds.consumption, consumption)
  })
} finally {
  if (plugin) await adminAx.delete(`/api/v1/plugins/${plugin.id}`)
  await fs.emptyDir('./data/test/')
  await apiServer.cleanDB()
  await apiServer.stop()
  process.exit(0)
}
