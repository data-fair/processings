import axios from 'axios'
import config from '../config.js'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'
import tmp from 'tmp-promise'
import { DataFairWsClient } from '@data-fair/lib/node/ws.js'
import { httpAgent, httpsAgent } from '@data-fair/lib/node/http-agents.js'
import { running } from '../utils/runs.js'

let pluginModule, _stopped
const processingsDir = path.join(config.dataDir, 'processings')

const axiosInstance = (processing) => {
  const headers = {
    'x-apiKey': config.dataFairAPIKey,
    referer: config.publicUrl
  }
  if (config.dataFairAdminMode) headers['x-account'] = JSON.stringify(processing.owner)
  headers['x-processing'] = JSON.stringify({ _id: processing._id, title: encodeURIComponent(processing.title) })

  const axiosInstance = axios.create({
    // this is necessary to prevent excessive memory usage during large file uploads, see https://github.com/axios/axios/issues/1045
    maxRedirects: 0,
    httpAgent,
    httpsAgent
  })
  // apply default base url and send api key when relevant
  axiosInstance.interceptors.request.use(cfg => {
    if (!/^https?:\/\//i.test(cfg.url)) {
      if (cfg.url.startsWith('/')) cfg.url = config.dataFairUrl + cfg.url
      else cfg.url = config.dataFairUrl + '/' + cfg.url
    }
    if (cfg.url.startsWith(config.dataFairUrl)) Object.assign(cfg.headers, headers)

    // no 'get' here so that it still appears in metrics
    if (['post', 'put', 'delete', 'patch'].includes(cfg.method) && config.privateDataFairUrl && cfg.url.startsWith(config.dataFairUrl)) {
      cfg.url = cfg.url.replace(config.dataFairUrl, config.privateDataFairUrl)
      cfg.headers.host = new URL(config.dataFairUrl).host
    }
    return cfg
  }, error => Promise.reject(error))
  // customize axios errors for shorter stack traces when a request fails
  axiosInstance.interceptors.response.use(response => response, error => {
    const response = error.response ?? error.request?.res ?? error.res
    if (!response) return Promise.reject(error)
    delete response.request
    const headers = {}
    if (response.headers?.location) headers.location = response.headers.location
    response.headers = headers
    response.config = response.config ?? error.config
    if (response.config) {
      response.config = { method: response.config.method, url: response.config.url, params: response.config.params, data: response.config.data }
      if (response.config.data && response.config.data._writableState) delete response.config.data
    }
    if (response.data && response.data._readableState) delete response.data
    return Promise.reject(response)
  })
  return axiosInstance
}

const wsInstance = (log) => {
  return new DataFairWsClient({
    url: config.dataFairUrl,
    apiKey: config.dataFairAPIKey,
    log,
    adminMode: config.dataFairAdminMode,
    account: config.account
  })
}

/**
 * @returns {import('@data-fair/lib/processings/types.js').LogFunctions} Log functions.
 */
const prepareLog = (db, wsPublish, processing, run) => {
  const pushLog = async (log) => {
    log.date = new Date().toISOString()
    await db.collection('runs').updateOne({ _id: run._id }, { $push: { log } })
    await wsPublish(`processings/${processing._id}/run-log`, { _id: run._id, log })
  }

  return {
    step: async (msg) => await pushLog({ type: 'step', msg }),
    error: async (msg, extra) => await pushLog({ type: 'error', msg, extra }),
    warning: async (msg, extra) => await pushLog({ type: 'warning', msg, extra }),
    info: async (msg, extra) => await pushLog({ type: 'info', msg, extra }),
    debug: async (msg, extra) => { if (!processing.debug) await pushLog({ type: 'debug', msg, extra }) },
    task: async (msg) => await pushLog({ type: 'task', msg }),
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

  const log = prepareLog(db, wsPublish, processing, run)
  log.warn = log.warning // for compatibility with old plugins
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
  const tmpDir = await tmp.dir({ unsafeCleanup: true, dir: config.tmpDir || path.resolve(config.dataDir, 'tmp') })
  const processingConfig = processing.config || {}
  const context = {
    pluginConfig,
    processingConfig,
    processingId: processing._id,
    dir,
    tmpDir: tmpDir.path,
    log,
    axios: axiosInstance(log),
    ws: wsInstance(log),
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
    pluginModule = await import(path.join(pluginDir + '/index.js'))
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
    throw err
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
