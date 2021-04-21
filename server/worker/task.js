const config = require('config')
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const runs = require('../utils/runs')

exports.run = async ({ db }) => {
  const [run, processing] = await Promise.all([
    db.collection('runs').findOne({ _id: process.argv[2] }),
    db.collection('processings').findOne({ _id: process.argv[3] }),
  ])
  const log = {
    step(msg) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'step', date: new Date().toISOString(), msg } } })
    },
    error(msg, extra) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'error', date: new Date().toISOString(), msg, extra } } })
    },
    warning(msg, extra) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'warning', date: new Date().toISOString(), msg, extra } } })
    },
    info(msg, extra) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'info', date: new Date().toISOString(), msg, extra } } })
    },
    debug(msg, extra, force) {
      if (!processing.debug && !force) return
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'debug', date: new Date().toISOString(), msg, extra } } })
    },
  }
  if (run.status === 'running') {
    log.info('Reprise après interruption.')
  }
  await runs.running(db, run)
  const pluginDir = path.resolve(config.dataDir, 'plugins', processing.plugin)

  let pluginConfig = {}
  if (await fs.exists(pluginDir + '-config.json')) {
    pluginConfig = await fs.readJson(pluginDir + '-config.json')
  }

  const headers = { 'x-apiKey': config.dataFairAPIKey }
  if (config.dataFairAdminMode) headers['x-account'] = `${processing.owner.type}:${processing.owner.id}`
  const axiosInstance = axios.create({ baseURL: config.dataFairUrl, headers })
  // customize axios errors for shorter stack traces when a request fails
  axiosInstance.interceptors.response.use(response => response, error => {
    if (!error.response) return Promise.reject(error)
    delete error.response.request
    error.response.config = { method: error.response.config.method, url: error.response.config.url, data: error.response.config.data }
    return Promise.reject(error.response)
  })

  const dir = path.resolve(config.dataDir, 'processings', processing._id)

  const context = {
    pluginConfig,
    processingConfig: processing.config || {},
    processingId: processing._id,
    dir,
    log,
    axios: axiosInstance,
  }
  try {
    const pluginModule = require(pluginDir)
    if (!pluginModule.preserveDir) await fs.emptyDir(dir)
    await pluginModule.run(context)
    if (!pluginModule.preserveDir) await fs.emptyDir(dir)
    await log.debug('finished')
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
