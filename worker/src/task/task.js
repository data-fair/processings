import axios from 'axios'
import axiosRetry from 'axios-retry'
import config from '../config.js'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'
import tmp from 'tmp-promise'
import { DataFairWsClient } from '@data-fair/lib/node/ws.js'
import { httpAgent, httpsAgent } from '@data-fair/lib/node/http-agents.js'
import { running } from '../utils/runs.js'

fs.ensureDirSync(config.dataDir)
const baseTmpDir = config.tmpDir || path.join(config.dataDir, 'tmp')
fs.ensureDirSync(baseTmpDir)

tmp.setGracefulCleanup()

/** @type {any} */
let pluginModule
/** @type {boolean} */
let _stopped
const processingsDir = path.join(config.dataDir, 'processings')

/** @typedef {import('../../../shared/types/run/index.js').Run} Run */

/**
 * Create an Axios instance.
 * @param {import('../../../shared/types/processing/index.js').Processing} processing
 * @returns {import('axios').AxiosInstance} Axios instance.
 */
const axiosInstance = (processing) => {
  /** @type {any} */
  const headers = {
    'x-apiKey': config.dataFairAPIKey
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
    if (!cfg.url) throw new Error('missing url in axios request')
    if (!/^https?:\/\//i.test(cfg.url)) {
      if (cfg.url.startsWith('/')) cfg.url = config.dataFairUrl + cfg.url
      else cfg.url = config.dataFairUrl + '/' + cfg.url
    }
    const isDataFairUrl = cfg.url.startsWith(config.dataFairUrl)
    if (isDataFairUrl) Object.assign(cfg.headers, headers)

    // use private data fair url if specified to prevent leaving internal infrastructure
    // except from GET requests so that they still appear in metrics
    // except if config.getFromPrivateDataFairUrl is set to true, then all requests are sent to the private url
    const usePrivate =
      config.privateDataFairUrl &&
      isDataFairUrl &&
      (config.getFromPrivateDataFairUrl || ['post', 'put', 'delete', 'patch'].includes(cfg.method || ''))
    if (usePrivate) {
      // @ts-ignore -> privateDataFairUrl can't be undefined here
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
    if (error.message) response.message = error.message
    if (error.stack) response.stack = error.stack
    return Promise.reject(response)
  })

  return axiosInstance
}

/**
 * Create a WebSocket instance.
 * @param {import('@data-fair/lib/processings/types.js').LogFunctions} log - Log functions.
 * @param {import('@data-fair/lib/express/index.js').Account} owner - Owner account.
 * @returns {DataFairWsClient} WebSocket instance.
 */
const wsInstance = (log, owner) => {
  return new DataFairWsClient({
    url: config.privateDataFairUrl || config.dataFairUrl,
    apiKey: config.dataFairAPIKey,
    log,
    adminMode: config.dataFairAdminMode,
    account: owner
  })
}

/**
 * Prepare log functions.
 * @param {import('mongodb').Collection<Run>} runsCollection - Runs collection
 * @param {(channel: string, data: any) => Promise<void>} wsPublish - Publish function
 * @param {import('../../../shared/types/processing/index.js').Processing} processing - Processing
 * @param {Run} run - run
 * @returns {import('@data-fair/lib/processings/types.js').LogFunctions} Log functions
 */
const prepareLog = (runsCollection, wsPublish, processing, run) => {
  /** @param {any} log - Log */
  const pushLog = async (log) => {
    log.date = new Date().toISOString()
    await runsCollection.updateOne({ _id: run._id }, { $push: { log } })
    await wsPublish(`processings/${processing._id}/run-log`, { _id: run._id, log })
  }

  return {
    step: async (msg) => await pushLog({ type: 'step', msg }),
    error: async (msg, extra = '') => await pushLog({ type: 'error', msg, extra }),
    warning: async (msg, extra = '') => await pushLog({ type: 'warning', msg, extra }),
    info: async (msg, extra = '') => await pushLog({ type: 'info', msg, extra }),
    debug: async (msg, extra = '') => { if (!processing.debug) await pushLog({ type: 'debug', msg, extra }) },
    task: async (msg) => await pushLog({ type: 'task', msg }),
    progress: async (msg, progress, total) => {
      const progressDate = new Date().toISOString()
      await runsCollection.updateOne({ _id: run._id, log: { $elemMatch: { type: 'task', msg } } },
        { $set: { 'log.$.progress': progress, 'log.$.total': total, 'log.$.progressDate': progressDate } })
      await wsPublish(`processings/${processing._id}/run-log`, { _id: run._id, log: { type: 'task', msg, progressDate, progress, total } })
    }
  }
}

/**
 * Run a processing.
 * @param {import('mongodb').Db} db - Database.
 * @param {any} mailTransport - Mail transport.
 * @param {(channel: string, data: any) => Promise<void>} wsPublish - Publish function.
 */
export const run = async (db, mailTransport, wsPublish) => {
  /** @type {import('mongodb').Collection<Run>} */
  const runsCollection = db.collection('runs')
  /** @type {import('mongodb').Collection<import('../../../shared/types/processing/index.js').Processing>} */
  const processingsCollection = db.collection('processings')
  /** @type {[Run | null, import('../../../shared/types/processing/index.js').Processing | null]} */
  const [run, processing] = await Promise.all([
    runsCollection.findOne({ _id: process.argv[2] }),
    processingsCollection.findOne({ _id: process.argv[3] })
  ])
  if (!run) throw new Error('Run not found')
  if (!processing) throw new Error('Processing not found')

  const log = prepareLog(runsCollection, wsPublish, processing, run)
  // @ts-expect-error -> warn is deprecated
  log.warn = log.warning // for compatibility with old plugins
  if (run.status === 'running') {
    await log.step('Reprise après interruption.')
  }
  await running(db, wsPublish, run)
  console.log('<running>')
  const pluginDir = path.resolve(config.dataDir, 'plugins', processing?.plugin)
  let pluginConfig = {}
  if (await fs.pathExists(pluginDir + '-config.json')) {
    pluginConfig = await fs.readJson(pluginDir + '-config.json')
  }
  if (!await fs.pathExists(pluginDir + '/index.js')) {
    throw new Error('fichier source manquant : ' + pluginDir + '/index.js')
  }

  const dir = resolvePath(processingsDir, processing._id)
  await fs.ensureDir(dir)
  const tmpDir = await tmp.dir({ unsafeCleanup: true, tmpdir: baseTmpDir, prefix: `processing-run-${processing._id}-${run._id}` })
  const processingConfig = processing?.config || {}

  const axios = axiosInstance(processing)
  axiosRetry(axios, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout: true,
    onRetry: (retryCount, err, requestConfig) => {
      const message = getHttpErrorMessage(err) || err.message || err
      log.warning(`tentative ${retryCount} de requête ${requestConfig.method} ${requestConfig.url} : ${message}`)
    }
  })

  /** @type {import('@data-fair/lib/processings/types.js').ProcessingContext} */
  const context = {
    pluginConfig,
    processingConfig,
    processingId: processing?._id,
    dir,
    tmpDir: tmpDir.path,
    log,
    axios: axiosInstance(processing),
    ws: wsInstance(log, processing?.owner),
    async patchConfig (patch) {
      await log.debug('patch config', patch)
      Object.assign(processingConfig, patch)
      processingsCollection.updateOne({ _id: processing._id }, { $set: { config: processingConfig } })
      await wsPublish(`processings/${processing._id}/patch-config`, { patch })
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
    if (_stopped) await log.error('L\'exécution a été interrompue', '')
    else await log.info('L\'exécution est terminée', '')
  } catch (/** @type {any} */ err) {
    process.chdir(cwd)
    const httpMessage = getHttpErrorMessage(err)
    if (httpMessage) {
      // console.error(httpMessage)
      // console.log(err)
      await log.error(httpMessage)
      await log.debug('axios error', err)
    } else {
      // console.error(err.message)
      // console.log(err)
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

const getHttpErrorMessage = (err) => {
  let httpMessage = err.status ?? err.statusCode
  if (httpMessage) {
    const statusText = err.statusText ?? err.statusMessage
    if (statusText) httpMessage += ' - ' + statusText
    if (err.data) {
      if (typeof err.data === 'string') httpMessage += ' - ' + err.data
      else httpMessage += ' - ' + JSON.stringify(err.data)
    } else if (err.message) {
      httpMessage += ' - ' + err.message
    }
    if (err.config && err.config.url) {
      let url = err.config.url
      url = url.replace(config.dataFairUrl, '')
      if (config.privateDataFairUrl) {
        url = url.replace(config.privateDataFairUrl, '')
      }
      httpMessage += ` (${url})`
    }
    return httpMessage
  }
}

export default { run, stop }
