import { strict as assert } from 'node:assert'
import { it, describe, before, beforeEach, after } from 'node:test'
import { axiosAuth, clean, startApiServer, startWorkerServer, stopApiServer, stopWorkerServer } from './utils/index.ts'
import * as testSpies from '@data-fair/lib-node/test-spies.js'

testSpies.registerModuleHooks()

const superadmin = await axiosAuth('superadmin@test.com')
const hlalonde = await axiosAuth({ email: 'hlalonde3@desdev.cn', org: 'KWqAGZ4mG', dep: 'dep1' })

let plugin
const createTestPlugin = async () => {
  plugin = (await superadmin.post('/api/v1/plugins', {
    name: '@data-fair/processing-hello-world',
    version: '0.12.2',
    distTag: 'latest',
    description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.'
  })).data
  await superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: true })
}

describe('processing', () => {
  before(startApiServer)
  before(startWorkerServer)
  beforeEach(clean)
  beforeEach(createTestPlugin)
  after(stopApiServer)
  after(stopWorkerServer)

  it('should create a new processing, activate it and run it', async () => {
    let processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id
    })).data
    assert.ok(processing._id)
    assert.deepEqual(processing.scheduling, [])
    assert.ok(!processing.webhookKey)

    const processings = (await superadmin.get('/api/v1/processings')).data
    assert.equal(processings.count, 1)
    assert.equal(processings.results[0]._id, processing._id)
    assert.ok(!processings.results[0].webhookKey)

    // no run at first
    let runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 0)

    // active but without scheduling = still no run
    await superadmin.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing'
      }
    })
    runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    console.log(runs)
    assert.equal(runs.count, 0)

    // active and with scheduling = a scheduled run
    await superadmin.patch(`/api/v1/processings/${processing._id}`, {
      scheduling: [{ type: 'monthly', dayOfWeek: '*', dayOfMonth: 1, month: '*', hour: 0, minute: 0 }]
    })
    runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    assert.equal(runs.results[0].status, 'scheduled')

    await superadmin.patch(`/api/v1/processings/${processing._id}`, { scheduling: [] })
    await Promise.all([
      superadmin.post(`/api/v1/processings/${processing._id}/_trigger`),
      testSpies.waitFor('isRunning', 10000)
    ])
    runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    assert.equal(runs.results[0].status, 'running')

    // nothing, failure is normal we have no api key
    const notif = await testSpies.waitFor('notificationSend', 10000) as { topic: { key: string } }
    assert.equal(notif.topic.key, `processings:processing-finish-error:${processing._id}`)
    await testSpies.waitFor('isFailure', 10000)

    const run = (await superadmin.get('/api/v1/runs/' + runs.results[0]._id)).data
    assert.equal(run.status, 'error')
    assert.equal(run.log[0].type, 'step')
    assert.equal(run.log[1].type, 'error')

    processing = (await superadmin.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(processing.lastRun)
    assert.equal(processing.lastRun.status, 'error')
    assert.ok(!processing.webhookKey)
  })

  it('should kill a long run with SIGTERM', async () => {
    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        message: 'Hello world test processing long',
        delay: 4
      }
    })).data

    await Promise.all([
      superadmin.post(`/api/v1/processings/${processing._id}/_trigger`),
      testSpies.waitFor('isRunning', 10000) // We wait for the run to be triggered
    ])
    const runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    let run = runs.results[0]
    assert.equal(run.status, 'running')
    await superadmin.post(`/api/v1/runs/${run._id}/_kill`)
    run = (await superadmin.get(`/api/v1/runs/${run._id}`)).data
    assert.equal(run.status, 'kill')
    await testSpies.waitFor('isKilled', 10000)
    run = (await superadmin.get(`/api/v1/runs/${run._id}`)).data
    assert.equal(run.status, 'killed')
    assert.equal(run.log.length, 4)

    // limits were updated
    const limits = (await superadmin.get('/api/v1/limits/user/superadmin')).data
    assert.ok(limits.processings_seconds.consumption >= 1)
    assert.equal(limits.processings_seconds.limit, -1)
  })

  it('should kill a long run with SIGTERM and wait for grace period', async () => {
    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        message: 'Hello world test processing long',
        delay: 10000,
        ignoreStop: true
      }
    })).data

    await Promise.all([
      superadmin.post(`/api/v1/processings/${processing._id}/_trigger`),
      testSpies.waitFor('isRunning', 10000) // We wait for the run to be triggered
    ])
    await new Promise(resolve => setTimeout(resolve, 1000))
    const runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    let run = runs.results[0]
    assert.equal(run.status, 'running')
    await superadmin.post(`/api/v1/runs/${run._id}/_kill`)
    run = (await superadmin.get(`/api/v1/runs/${run._id}`)).data
    assert.equal(run.status, 'kill')
    await testSpies.waitFor('isKilled', 10000)
    run = (await superadmin.get(`/api/v1/runs/${run._id}`)).data
    assert.equal(run.status, 'killed')
    assert.equal(run.log.length, 2)
  })

  it('should fail a run if processings_seconds limit is exceeded', async () => {
    await superadmin.post('/api/v1/limits/user/superadmin', {
      processings_seconds: { limit: 1 },
      lastUpdate: new Date().toISOString()
    })

    const processing = (await superadmin.post('/api/v1/processings', {
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

    await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)
    await testSpies.waitFor('isFailure', 10000)

    let limits = (await superadmin.get('/api/v1/limits/user/superadmin')).data
    const consumption = limits.processings_seconds.consumption
    assert.ok(consumption >= 1)

    superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)
    await testSpies.waitFor('processingsSecondsExceeded', 10000)
    limits = (await superadmin.get('/api/v1/limits/user/superadmin')).data
    assert.equal(limits.processings_seconds.consumption, consumption)
  })

  it('should manage a processing as a department admin', async () => {
    const processing = (await hlalonde.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id
    })).data

    const processings = (await hlalonde.get('/api/v1/processings')).data
    assert.equal(processings.count, 1)
    assert.equal(processings.results[0]._id, processing._id)
    await hlalonde.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing'
      }
    })

    await Promise.all([
      hlalonde.post(`/api/v1/processings/${processing._id}/_trigger`),
      testSpies.waitFor('isFailure', 10000)
    ])

    const runs = (await hlalonde.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    // failure is normal we have no api key
    assert.equal(runs.results[0].status, 'error')
  })
})
