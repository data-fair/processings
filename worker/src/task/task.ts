import type { LogFunctions, ProcessingContext } from '@data-fair/lib-common-types/processings.ts'
import type { Account } from '@data-fair/lib-express/index.js'
import type { Processing, Run } from '#api/types'

import util from 'node:util'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'
import tmp from 'tmp-promise'
import { DataFairWsClient } from '@data-fair/lib-node/ws-client.js'
import * as wsEmitter from '@data-fair/lib-node/ws-emitter.js'
import { decipher } from '@data-fair/processings-shared/cipher.ts'
import { running } from '../utils/runs.ts'
import config from '#config'
import mongo from '#mongo'
import { getAxiosInstance, getHttpErrorMessage, prepareAxiosError } from './axios.ts'

fs.ensureDirSync(config.dataDir)
const baseTmpDir = config.tmpDir || path.join(config.dataDir, 'tmp')
fs.ensureDirSync(baseTmpDir)

tmp.setGracefulCleanup()

let pluginModule: { run: (context: ProcessingContext) => Promise<void>, stop?: () => Promise<void> }
let _stopped: boolean
const processingsDir = path.join(config.dataDir, 'processings')

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
const prepareLog = (processing: Processing, run: Run): LogFunctions => {
  const pushLog = async (log: any) => {
    log.date = new Date().toISOString()
    await mongo.runs.updateOne({ _id: run._id }, { $push: { log } })
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
      await mongo.runs.updateOne({ _id: run._id, log: { $elemMatch: { type: 'task', msg } } },
        { $set: { 'log.$.progress': progress, 'log.$.total': total, 'log.$.progressDate': progressDate } })
      await wsEmitter.emit(`processings/${processing._id}/run-log`, { _id: run._id, log: { type: 'task', msg, progressDate, progress, total } })
    }
  }
}

/**
 * Run a processing.
 */
export const run = async (mailTransport: any) => {
  const [run, processing] = await Promise.all([
    mongo.runs.findOne({ _id: process.argv[2] }),
    mongo.processings.findOne({ _id: process.argv[3] })
  ])
  if (!run) throw new Error('Run not found')
  if (!processing) throw new Error('Processing not found')

  const log = prepareLog(processing, run)
  // @ts-expect-error -> warn is deprecated
  log.warn = log.warning // for compatibility with old plugins
  if (run.status === 'running') {
    await log.step('Reprise après interruption.')
  }
  await running(run)
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

  const axiosInstance = getAxiosInstance(processing, log)

  const secrets: Record<string, string> = {}
  if (processing.secrets) {
    Object.keys(processing.secrets).forEach(key => {
      secrets[key] = decipher(processing.secrets![key], config.cipherPassword)
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
      mongo.processings.updateOne({ _id: processing._id }, { $set: { config: processingConfig } })
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
      console.error(httpMessage)
      await log.error(httpMessage)
      await log.debug('axios error', errStr)
    } else {
      console.error(err.message || err)
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

export default { run, stop }
