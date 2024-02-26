import axios from 'axios'
import config from 'config'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'
import tmp from 'tmp-promise'
import { DataFairWsClient } from '@data-fair/lib/node/ws.js'
import { running } from './utils/runs.js'

let pluginModule, _stopped
const processingsDir = path.join(config.dataDir, 'processings')

const axiosInstance = (config) => {
  const headers = { 'x-apiKey': config.dataFairAPIKey }
  const axiosInstance = axios.create({
    // this is necessary to prevent excessive memory usage during large file uploads, see https://github.com/axios/axios/issues/1045
    maxRedirects: 0
  })
  // apply default base url and send api key when relevant
  axiosInstance.interceptors.request.use(cfg => {
    if (cfg.url && !/^https?:\/\//i.test(cfg.url)) {
      if (cfg.url.startsWith('/')) cfg.url = config.dataFairUrl + cfg.url
      else cfg.url = config.dataFairUrl + '/' + cfg.url
    }
    if (cfg.url && cfg.url.startsWith(config.dataFairUrl)) Object.assign(cfg.headers, headers)
    return cfg
  }, error => Promise.reject(error))
  // customize axios errors for shorter stack traces when a request fails
  axiosInstance.interceptors.response.use(response => response, error => {
    if (!error.response) return Promise.reject(error)
    delete error.response.request
    const headers = {}
    if (error.response.headers.location) headers.location = error.response.headers.location
    error.response.headers = headers
    error.response.config = { method: error.response.config.method, url: error.response.config.url, data: error.response.config.data }
    if (error.response.config.data && error.response.config.data._writableState) delete error.response.config.data
    if (error.response.data && error.response.data._readableState) delete error.response.data
    return Promise.reject(error.response)
  })
  return axiosInstance
}

const wsInstance = (config, log) => {
  return new DataFairWsClient({
    url: config.dataFairUrl,
    apiKey: config.dataFairAPIKey,
    log,
    adminMode: config.dataFairAdminMode,
    account: config.account
  })
}

const prepareLog = (db, wsPublish, processing) => {
  const pushLog = async (log) => {
    await db.collection('runs').updateOne({ _id: run._id }, { $push: { log } })
    await wsPublish(`processings/${processing._id}/run-log`, { _id: run._id, log })
  }

  return {
    step: async (msg) => pushLog({ type: 'step', date: new Date().toISOString(), msg }),
    error: async (msg, extra) => pushLog({ type: 'error', date: new Date().toISOString(), msg, extra }),
    warning: async (msg, extra) => pushLog({ type: 'warning', date: new Date().toISOString(), msg, extra }),
    info: async (msg, extra) => pushLog({ type: 'info', date: new Date().toISOString(), msg, extra }),
    debug: async (msg, extra) => { if (!processing.debug) pushLog({ type: 'debug', date: new Date().toISOString(), msg, extra }) },
    task: async (msg) => pushLog({ type: 'task', date: new Date().toISOString(), msg }),
    progress: async (msg, progress, total) => {
      const progressDate = new Date().toISOString()
      await db.collection('runs')
        .updateOne({ _id: run._id, log: { $elemMatch: { type: 'task', msg } } },
          { $set: { 'log.$.progress': progress, 'log.$.total': total, 'log.$.progressDate': progressDate } })
      await wsPublish(`processings/${processing._id}/run-log`, { _id: run._id, log: { type: 'task', msg, progressDate, progress, total } })
    }
  }
}

export const run = async ({ db, mailTransport, wsPublish }) => {
  const [run, processing] = await Promise.all([
    db.collection('runs').findOne({ _id: process.argv[2] }),
    db.collection('processings').findOne({ _id: process.argv[3] })
  ])

  const log = prepareLog(db, wsPublish, processing)
  if (run.status === 'running') {
    await log.step('Reprise après interruption.')
  }
  await running(db, wsPublish, run)
  const pluginDir = path.resolve(config.dataDir, 'plugins', processing.plugin)

  let pluginConfig = {}
  if (await fs.pathExists(pluginDir + '-config.json')) {
    pluginConfig = await fs.readJson(pluginDir + '-config.json')
  }
  if (!await fs.pathExists(pluginDir + '/index.js')) {
    throw new Error('fichier source manquant : ' + pluginDir + '/index.js')
  }

  const dir = resolvePath(processingsDir, processing._id)
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
    ws: wsInstance(config, log),
    async patchConfig (patch) {
      await log.debug('patch config', patch)
      Object.assign(processingConfig, patch)
      db.collection('processings').updateOne({ _id: processing._id }, { $set: { config: processingConfig } })
    },
    async sendMail (data) {
      return mailTransport.sendMail(data)
    }
  }

  const cwd = process.cwd()
  try {
    pluginModule = require(pluginDir + '/index.js')
    process.chdir(dir)
    await pluginModule.run(context)
    process.chdir(cwd)
    if (_stopped) await log.error('interrompu')
    else await log.info('terminé')
  } catch (err) {
    process.chdir(cwd)
    const errStatus = err.status ?? err.statusCode
    let httpMessage = err.data && typeof err.data === 'string' ? err.data : (err.statusText ?? err.statusMessage)
    if (errStatus && httpMessage) {
      if (err.config && err.config.url) {
        let url = err.config.url
        url = url.replace(config.dataFairUrl, '')
        httpMessage += ` (${url})`
      }
      console.error(httpMessage)
      console.log(err)
      await log.error(httpMessage)
      await log.debug('axios error', err)
    } else {
      console.error(err.message)
      console.log(err)
      await log.error(err.message)
      await log.debug(err.stack)
    }
    return err
  } finally {
    await tmpDir.cleanup()
  }
}

export const stop = async () => {
  _stopped = true
  if (pluginModule && pluginModule.stop) await pluginModule.stop()
  // grace period of 20s, either run() finishes in the interval or we shutdown
  await new Promise(resolve => setTimeout(resolve, config.worker.gracePeriod))
}

export default { run, stop }
