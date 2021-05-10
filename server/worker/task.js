const config = require('config')
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const tmp = require('tmp-promise')
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
  log.warn = log.warning
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
  if (config.dataFairAdminMode) headers['x-account'] = JSON.stringify(processing.owner)
  const axiosInstance = axios.create()
  // apply default base url and send api key when relevant
  axiosInstance.interceptors.request.use(cfg => {
    if (!/^https?:\/\//i.test(cfg.url)) {
      if (cfg.url.startsWith('/')) cfg.url = config.dataFairUrl + cfg.url
      else cfg.url = config.dataFairUrl + '/' + cfg.url
    }
    if (cfg.url.startsWith(config.dataFairUrl)) Object.assign(cfg.headers, headers)
    return cfg
  }, error => Promise.reject(error))
  // customize axios errors for shorter stack traces when a request fails
  axiosInstance.interceptors.response.use(response => response, error => {
    if (!error.response) return Promise.reject(error)
    delete error.response.request
    delete error.response.headers
    error.response.config = { method: error.response.config.method, url: error.response.config.url, data: error.response.config.data }
    if (error.response.config.data && error.response.config.data._writableState) delete error.response.config.data
    if (error.response.data && error.response.data._readableState) delete error.response.data
    return Promise.reject(error.response)
  })

  const dir = path.resolve(config.dataDir, 'processings', processing._id)
  await fs.ensureDir(dir)
  const tmpDir = await tmp.dir({ unsafeCleanup: true })
  const processingConfig = processing.config || {}
  const context = {
    pluginConfig,
    processingConfig,
    processingId: processing._id,
    dir,
    tmpDir: tmpDir.path,
    log,
    axios: axiosInstance,
    async patchConfig(patch) {
      await log.debug('patch config', patch)
      Object.assign(processingConfig, patch)
      db.collection('processings').updateOne({ _id: processing._id }, { $set: { config: processingConfig } })
    },
  }
  const cwd = process.cwd()
  try {
    const pluginModule = require(pluginDir)
    process.chdir(dir)
    await pluginModule.run(context)
    process.chdir(cwd)
    await tmpDir.cleanup()
    await log.info('terminé')
  } catch (err) {
    process.chdir(cwd)
    if (err.status && err.statusText) {
      await log.error(err.data && typeof err.data === 'string' ? err.data : err.statusText)
      await log.debug('axios error', err, true)
    } else {
      await log.error(err.message)
      await log.debug(err.stack)
    }
    await tmpDir.cleanup()
    process.exit(-1)
  }
}
