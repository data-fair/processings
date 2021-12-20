
const assert = require('assert').strict
const worker = require('../server/worker')

describe('Processings', () => {
  let plugin
  before('prepare a plugin', async () => {
    plugin = (await global.ax.superadmin.post('/api/v1/plugins', {
      name: '@data-fair/processing-hello-world',
      version: '0.9.4',
      description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.',
      npm: 'https://www.npmjs.com/package/%40data-fair%2Fprocessing-hello-world',
    })).data
  })

  it('should create a new processing, activate it and run it', async () => {
    let processing = (await global.ax.superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
    })).data
    assert.ok(processing._id)
    assert.equal(processing.scheduling.type, 'trigger')

    // no run at first
    let runs = (await global.ax.superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 0)

    // active but without scheduling = still no run
    await global.ax.superadmin.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing',
      },
    })
    runs = (await global.ax.superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 0)

    // active and with scheduling = a scheduled run
    await global.ax.superadmin.patch(`/api/v1/processings/${processing._id}`, {
      scheduling: { type: 'monthly', dayOfWeek: '*', dayOfMonth: 1, month: '*', hour: 0, minute: 0 },
    })
    runs = (await global.ax.superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    assert.equal(runs.results[0].status, 'scheduled')

    await global.ax.superadmin.patch(`/api/v1/processings/${processing._id}`, { scheduling: { type: 'trigger' } })
    await global.ax.superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)
    runs = (await global.ax.superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    assert.equal(runs.results[0].status, 'triggered')
    try {
      await worker.hook(processing._id)
      assert.fail()
    } catch (err) {
      // nothing, failure is normal we have no api key
    }
    const run = (await global.ax.superadmin.get('/api/v1/runs/' + runs.results[0]._id)).data
    assert.equal(run.status, 'error')
    assert.equal(run.log[0].type, 'step')
    assert.equal(run.log[1].type, 'error')

    processing = (await global.ax.superadmin.get(`/api/v1/processings/${processing._id}`)).data
    assert.ok(processing.lastRun)
    assert.equal(processing.lastRun.status, 'error')
  })

  it('should kill a long run with SIGTERM', async () => {
    const processing = (await global.ax.superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        message: 'Hello world test processing long',
        delay: 4,
      },
    })).data

    await global.ax.superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)
    const runs = (await global.ax.superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    let run = runs.results[0]
    assert.equal(run.status, 'triggered')
    await new Promise(resolve => setTimeout(resolve, 1000))
    await global.ax.superadmin.post(`/api/v1/runs/${run._id}/_kill`)
    run = (await global.ax.superadmin.get(`/api/v1/runs/${run._id}`)).data
    assert.equal(run.status, 'kill')
    await worker.hook(processing._id)
    run = (await global.ax.superadmin.get(`/api/v1/runs/${run._id}`)).data
    assert.equal(run.status, 'killed')
    assert.equal(run.log.length, 4)
  })

  it('should kill a long run with SIGKILL', async () => {
    const processing = (await global.ax.superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'hello-world-test-processings', title: 'Hello world test processing' },
        message: 'Hello world test processing long',
        delay: 4,
        ignoreStop: true,
      },
    })).data

    await global.ax.superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)
    const runs = (await global.ax.superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 1)
    let run = runs.results[0]
    assert.equal(run.status, 'triggered')
    await new Promise(resolve => setTimeout(resolve, 1000))
    await global.ax.superadmin.post(`/api/v1/runs/${run._id}/_kill`)
    run = (await global.ax.superadmin.get(`/api/v1/runs/${run._id}`)).data
    assert.equal(run.status, 'kill')
    await worker.hook(processing._id)
    run = (await global.ax.superadmin.get(`/api/v1/runs/${run._id}`)).data
    assert.equal(run.status, 'killed')
    assert.equal(run.log.length, 2)
  })
})
