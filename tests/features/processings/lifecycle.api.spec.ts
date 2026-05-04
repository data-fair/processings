import { test, expect } from '@playwright/test'
import { axiosAuth, clean, waitForRunStatus } from '../../support/axios.ts'

const installTestPlugin = async (superadmin: any) => {
  const plugin = (await superadmin.post('/api/v1/plugins', {
    name: '@data-fair/processing-hello-world',
    version: '1.2.2',
    distTag: 'latest',
    description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.'
  })).data
  await superadmin.put(`/api/v1/plugins/${plugin.id}/access`, { public: true })
  return plugin
}

test.describe('processing', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('should create a new processing, activate it and run it', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installTestPlugin(superadmin)

    let processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
    })).data
    expect(processing._id).toBeTruthy()
    expect(processing.scheduling).toEqual([])
    expect(processing.webhookKey).toBeFalsy()

    const processings = (await superadmin.get('/api/v1/processings?showAll=true&owner=user:test_superadmin')).data
    expect(processings.results.find((p: any) => p._id === processing._id)).toBeTruthy()

    let runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    expect(runs.count).toBe(0)

    await superadmin.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing'
      }
    })
    runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    expect(runs.count).toBe(0)

    await superadmin.patch(`/api/v1/processings/${processing._id}`, {
      scheduling: [{ type: 'monthly', dayOfWeek: '*', dayOfMonth: 1, month: '*', hour: 0, minute: 0 }]
    })
    runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    expect(runs.count).toBe(1)
    expect(runs.results[0].status).toBe('scheduled')

    await superadmin.patch(`/api/v1/processings/${processing._id}`, { scheduling: [] })
    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    const finishedRun = await waitForRunStatus(triggered._id, 'finished', 30_000)
    expect(finishedRun.status).toBe('finished')

    runs = (await superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    expect(runs.count).toBe(1)

    const run = (await superadmin.get('/api/v1/runs/' + runs.results[0]._id)).data
    expect(run.status).toBe('finished')
    expect(run.log.length).toBeGreaterThan(0)
    expect(run.log.some((l: any) => l.type === 'step')).toBe(true)

    processing = (await superadmin.get(`/api/v1/processings/${processing._id}`)).data
    expect(processing.lastRun).toBeTruthy()
    expect(processing.lastRun.status).toBe('finished')
  })

  test('should kill a long run with SIGTERM', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installTestPlugin(superadmin)

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' },
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_hello-world-test-processings', title: 'Hello world test processing' },
        message: 'Hello world test processing long',
        delay: 4
      }
    })).data

    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    await waitForRunStatus(triggered._id, 'running')
    await superadmin.post(`/api/v1/runs/${triggered._id}/_kill`)
    const killedRun = await waitForRunStatus(triggered._id, 'killed')
    expect(killedRun.log.length).toBe(6)

    const limits = (await superadmin.get('/api/v1/limits/user/test_superadmin')).data
    expect(limits.processings_seconds.consumption).toBeGreaterThanOrEqual(1)
    expect(limits.processings_seconds.limit).toBe(-1)
  })

  test('should kill a long run with SIGTERM and wait for grace period', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installTestPlugin(superadmin)

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' },
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_hello-world-test-processings', title: 'Hello world test processing' },
        message: 'Hello world test processing long',
        delay: 10000,
        ignoreStop: true
      }
    })).data

    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    await waitForRunStatus(triggered._id, 'running')
    await new Promise(resolve => setTimeout(resolve, 1000))
    await superadmin.post(`/api/v1/runs/${triggered._id}/_kill`)
    const killedRun = await waitForRunStatus(triggered._id, 'killed', 30_000)
    expect(killedRun.log.length).toBe(4)
  })

  test('should fail a run if processings_seconds limit is exceeded', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installTestPlugin(superadmin)

    await superadmin.post('/api/v1/limits/user/test_superadmin', {
      processings_seconds: { limit: 1 },
      lastUpdate: new Date().toISOString()
    })

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' },
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_hello-world-test-processings', title: 'Hello world test processing' },
        message: 'Hello world test processing long',
        delay: 1,
        ignoreStop: true
      }
    })).data

    const firstRun = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    await waitForRunStatus(firstRun._id, 'finished', 30_000)

    let limits = (await superadmin.get('/api/v1/limits/user/test_superadmin')).data
    const consumption = limits.processings_seconds.consumption
    expect(consumption).toBeGreaterThanOrEqual(1)

    const secondRun = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    await waitForRunStatus(secondRun._id, 'error', 15_000)
    limits = (await superadmin.get('/api/v1/limits/user/test_superadmin')).data
    expect(limits.processings_seconds.consumption).toBe(consumption)
  })

  test('should manage a processing as a department admin', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installTestPlugin(superadmin)
    const depAdmin = await axiosAuth({ email: 'test_dep_admin@test.com', org: 'test_org1', dep: 'dep1' })

    const processing = (await depAdmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id
    })).data

    const processings = (await depAdmin.get('/api/v1/processings')).data
    expect(processings.count).toBe(1)
    expect(processings.results[0]._id).toBe(processing._id)

    await depAdmin.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing'
      }
    })

    const triggered = (await depAdmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    await waitForRunStatus(triggered._id, 'finished', 30_000)

    const runs = (await depAdmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    expect(runs.count).toBe(1)
    expect(runs.results[0].status).toBe('finished')
  })

  test('should config a new processing with a secret field', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installTestPlugin(superadmin)

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
    })).data
    expect(processing._id).toBeTruthy()

    const patchRes = await superadmin.patch(`/api/v1/processings/${processing._id}`, {
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing',
        secretField: 'my secret value'
      }
    })
    expect(patchRes.data.config.secretField).toBe('********')

    const getRes = await superadmin.get(`/api/v1/processings/${processing._id}`)
    expect(getRes.data.config.secretField).toBe('********')

    await superadmin.patch(`/api/v1/processings/${processing._id}`, {
      config: {
        datasetMode: 'create',
        dataset: { id: 'test_hello-world-test-processings', title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing',
        secretField: 'my new secret value'
      }
    })

    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    await waitForRunStatus(triggered._id, 'finished', 30_000)

    const run = (await superadmin.get('/api/v1/runs/' + triggered._id)).data
    expect(run.status).toBe('finished')
    expect(run.log[1].type).toBe('info')
    expect(run.log[1].extra.secrets.secretField).toBe('my new secret value')
  })

  test('should patch config with secrets', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const plugin = await installTestPlugin(superadmin)

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' },
      active: true,
      config: {
        datasetMode: 'create',
        dataset: { title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing',
        secretField: 'my secret value'
      }
    })).data
    expect(processing.config.secretField).toBe('********')

    let patchRes = await superadmin.patch(`/api/v1/processings/${processing._id}`, {
      config: {
        datasetMode: 'create',
        dataset: { title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing (edited)',
        secretField: '********'
      }
    })
    expect(patchRes.data.config.secretField).toBe('********')

    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    await waitForRunStatus(triggered._id, 'finished', 30_000)

    const run = (await superadmin.get('/api/v1/runs/' + triggered._id)).data
    expect(run.status).toBe('finished')
    expect(run.log[1].extra.secrets.secretField).toBe('my secret value')

    patchRes = await superadmin.patch(`/api/v1/processings/${processing._id}`, {
      config: {
        datasetMode: 'create',
        dataset: { title: 'Hello world test processing' },
        overwrite: false,
        message: 'Hello world test processing (edited)',
        secretField: ''
      }
    })
    expect(patchRes.data.config.secretField).toBe('')

    const lastTrigger = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
    await waitForRunStatus(lastTrigger._id, 'finished', 30_000)
  })
})
