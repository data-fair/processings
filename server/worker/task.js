const config = require('config')
const path = require('path')
const fs = require('fs-extra')
const tmp = require('tmp-promise')
const axios = require('axios')

exports.run = async ({ db }) => {
  const [run, processing] = await Promise.all([
    db.collection('runs').findOne({ _id: process.argv[2] }),
    db.collection('processings').findOne({ _id: process.argv[3] }),
  ])
  const log = {
    step(msg) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'step', msg } } })
    },
    error(msg, extra) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'error', msg, extra } } })
    },
    warning(msg, extra) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'warning', msg, extra } } })
    },
    info(msg, extra) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'info', msg, extra } } })
    },
    debug(msg, extra, force) {
      if (!processing.debug && !force) return
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'debug', msg, extra } } })
    },
  }

  if (run.status === 'running') {
    log.info('Reprise après interruption.')
  }
  await db.collection('runs')
    .updateOne({ _id: run._id }, { $set: { status: 'running', startedAt: new Date().toISOString() } })

  const pluginDir = path.resolve(config.dataDir, 'plugins', processing.plugin)

  let pluginConfig = {}
  if (await fs.exists(pluginDir + '-config.json')) {
    pluginConfig = await fs.readJson(pluginDir + '-config.json')
  }

  const headers = { 'x-apiKey': config.dataFairAPIKey }
  if (config.dataFairAdminMode) headers['x-account'] = `${processing.owner.type}:${processing.owner.id}`
  const axiosInstance = axios.create({ baseURL: config.dataFairUrl, headers })
  // customize axios errors for shorter stack traces when a request fails in a test
  axiosInstance.interceptors.response.use(response => response, error => {
    if (!error.response) return Promise.reject(error)
    delete error.response.request
    error.response.config = { method: error.response.config.method, url: error.response.config.url, data: error.response.config.data }
    return Promise.reject(error.response)
  })

  const context = {
    pluginConfig,
    processingConfig: processing.config || {},
    processingId: processing._id,
    tmpDir: await tmp.dir({ unsafeCleanup: true }),
    log,
    axios: axiosInstance,
  }
  try {
    await require(pluginDir).run(context)
  } catch (err) {
    if (err.status && err.statusText) {
      await log.error(err.data && typeof err.data === 'string' ? err.data : err.statusText)
      await log.debug('axios error', err, true)
    } else {
      await log.error(err.message)
      await log.debug(err.stack)
    }
    process.exit(-1)
  }
}
