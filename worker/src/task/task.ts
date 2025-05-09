import type { LogFunctions, ProcessingContext } from '@data-fair/lib-common-types/processings.ts'
import type { Account } from '@data-fair/lib-express/index.js'
import type { Collection, Db } from 'mongodb'
import type { Processing, Run } from '#api/types'

import axios from 'axios'
import axiosRetry from 'axios-retry'
import util from 'node:util'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'
import tmp from 'tmp-promise'
import { DataFairWsClient } from '@data-fair/lib-node/ws-client.js'
import { httpAgent, httpsAgent } from '@data-fair/lib-node/http-agents.js'
import * as wsEmitter from '@data-fair/lib-node/ws-emitter.js'
import { running } from '../utils/runs.ts'
import { decipher } from '../utils/cipher.ts'
import config from '#config'

fs.ensureDirSync(config.dataDir)
const baseTmpDir = config.tmpDir || path.join(config.dataDir, 'tmp')
fs.ensureDirSync(baseTmpDir)

tmp.setGracefulCleanup()

let pluginModule: { run: (context: ProcessingContext) => Promise<void>, stop?: () => Promise<void> }
let _stopped: boolean
const processingsDir = path.join(config.dataDir, 'processings')

/**
 * Create an Axios instance.
 */
const getAxiosInstance = (processing: Processing) => {
  const headers: Record<string, string> = {
    'x-apiKey': config.dataFairAPIKey
  }
  if (config.dataFairAdminMode) {
    const account = { ...processing.owner }
    if (account.name) account.name = encodeURIComponent(account.name)
    if (account.departmentName) account.departmentName = encodeURIComponent(account.departmentName)
    headers['x-account'] = JSON.stringify(account)
  }
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
    cfg.headers['User-Agent'] = cfg.headers['User-Agent'] ?? `@data-fair/processings (${processing.plugin})`

    // use private data fair url if specified to prevent leaving internal infrastructure
    // except from GET requests so that they still appear in metrics
    // except if config.getFromPrivateDataFairUrl is set to true, then all requests are sent to the private url
    const usePrivate =
      config.privateDataFairUrl &&
      isDataFairUrl &&
      (config.getFromPrivateDataFairUrl || ['post', 'put', 'delete', 'patch'].includes(cfg.method || ''))
    if (usePrivate) {
      cfg.url = cfg.url.replace(config.dataFairUrl, config.privateDataFairUrl!)
      cfg.headers.host = new URL(config.dataFairUrl).host
    }
    return cfg
  }, error => Promise.reject(error))

  return axiosInstance
}

// customize axios errors for shorter stack traces when a request fails
// WARNING: we used to do it in an interceptor, but it was incompatible with axios-retry
const prepareAxiosError = (error: any) => {
  const response = error.response ?? error.request?.res ?? error.res
  if (!response) return error
  delete response.request
  const headers: Record<string, string> = {}
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
  return response
}

/**
 * Create a WebSocket instance.
 */
const wsInstance = (log: LogFunctions, owner: Account): DataFairWsClient => {
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
 */
const prepareLog = (runsCollection: Collection<Run>, processing: Processing, run: Run): LogFunctions => {
  const pushLog = async (log: any) => {
    log.date = new Date().toISOString()
    await runsCollection.updateOne({ _id: run._id }, { $push: { log } })
    await wsEmitter.emit(`processings/${processing._id}/run-log`, { _id: run._id, log })
  }

  return {
    step: async (msg) => await pushLog({ type: 'step', msg }),
    error: async (msg, extra = '') => await pushLog({ type: 'error', msg, extra }),
    warning: async (msg, extra = '') => await pushLog({ type: 'warning', msg, extra }),
    info: async (msg, extra = '') => await pushLog({ type: 'info', msg, extra }),
    debug: async (msg, extra = '') => {
      if (processing.debug) await pushLog({ type: 'debug', msg, extra })
    },
    task: async (msg) => await pushLog({ type: 'task', msg }),
    progress: async (msg, progress, total) => {
      const progressDate = new Date().toISOString()
      await runsCollection.updateOne({ _id: run._id, log: { $elemMatch: { type: 'task', msg } } },
        { $set: { 'log.$.progress': progress, 'log.$.total': total, 'log.$.progressDate': progressDate } })
      await wsEmitter.emit(`processings/${processing._id}/run-log`, { _id: run._id, log: { type: 'task', msg, progressDate, progress, total } })
    }
  }
}

/**
 * Run a processing.
 */
export const run = async (db: Db, mailTransport: any) => {
  const runsCollection = db.collection('runs') as Collection<Run>
  const processingsCollection = db.collection('processings') as Collection<Processing>
  const [run, processing] = await Promise.all([
    runsCollection.findOne({ _id: process.argv[2] }),
    processingsCollection.findOne({ _id: process.argv[3] })
  ])
  if (!run) throw new Error('Run not found')
  if (!processing) throw new Error('Processing not found')

  const log = prepareLog(runsCollection, processing, run)
  // @ts-expect-error -> warn is deprecated
  log.warn = log.warning // for compatibility with old plugins
  if (run.status === 'running') {
    await log.step('Reprise après interruption.')
  }
  await running(db, run)
  console.log('<running>')
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
  const tmpDir = await tmp.dir({ unsafeCleanup: true, tmpdir: baseTmpDir, prefix: `processing-run-${processing._id}-${run._id}` })
  const processingConfig = processing.config || {}

  const axiosInstance = getAxiosInstance(processing)
  axiosRetry(axiosInstance, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout: true,
    onRetry: (retryCount, _err, requestConfig) => {
      const err = prepareAxiosError(_err)
      const message = getHttpErrorMessage(err) || err.message || err
      log.warning(`tentative ${retryCount} de requête ${requestConfig.method} ${requestConfig.url} : ${message}`)
    }
  })

  const secrets: Record<string, string> = {}
  if (processing.secrets) {
    Object.keys(processing.secrets).forEach(key => {
      secrets[key] = decipher(processing.secrets![key])
    })
  }

  const context: ProcessingContext = {
    pluginConfig,
    processingConfig,
    secrets,
    processingId: processing._id,
    dir,
    tmpDir: tmpDir.path,
    log,
    axios: axiosInstance,
    ws: wsInstance(log, processing.owner),
    async patchConfig (patch) {
      await log.debug('patch config', patch)
      Object.assign(processingConfig, patch)
      processingsCollection.updateOne({ _id: processing._id }, { $set: { config: processingConfig } })
      await wsEmitter.emit(`processings/${processing._id}/patch-config`, { patch })
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
  } catch (e: any) {
    process.chdir(cwd)
    const err = prepareAxiosError(e)
    const httpMessage = getHttpErrorMessage(err)

    if (httpMessage) {
      let errStr = util.inspect(err, { depth: 5 })
      if (errStr.length > 10000) {
        errStr = errStr.slice(0, 10000) + '...'
      }
      console.log(errStr)
      await log.error(httpMessage)
      await log.debug('axios error', errStr)
    } else {
      console.log(err)
      await log.error(err.message)
      await log.debug(err.stack)
    }
    return err
  } finally {
    try {
      await tmpDir.cleanup()
    } catch (err) {
      console.error('[task-tmp-cleanup]', err, { processingId: processing._id, runId: run._id })
    }
  }
}

export const stop = async () => {
  _stopped = true
  if (pluginModule && pluginModule.stop) await pluginModule.stop()
  // grace period of 20s, either run() finishes in the interval or we shutdown
  await new Promise(resolve => setTimeout(resolve, config.worker.gracePeriod))
}

const getHttpErrorMessage = (err: any) => {
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
