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
import { ensureArtefact } from '@data-fair/lib-node-registry'
import { decipher } from '@data-fair/processings-shared/cipher.ts'
import { parsePluginId } from '@data-fair/processings-shared/plugin-id.ts'
import { importPluginModule } from '@data-fair/processings-shared/plugin-load.ts'
import { running } from '../utils/runs.ts'
import config, { registryCacheDir } from '#config'
import mongo from '#mongo'
import { getAxiosInstance, getHttpErrorMessage, prepareAxiosError } from './axios.ts'

if (config.dataDir) fs.ensureDirSync(config.dataDir)
fs.ensureDirSync(config.tmpDir)

tmp.setGracefulCleanup()

let pluginModule: { run: (context: ProcessingContext) => Promise<{ deleteOnComplete?: boolean } | void>, stop?: () => Promise<void> }
let _stopped: boolean
const processingsDir = path.join(config.dataDir ?? config.tmpDir, 'processings')

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
  // Resolve plugin via registry. lib-node downloads + extracts the tarball into
  // registryCacheDir on cache miss, returns the existing path on cache hit.
  // account is passed so registry enforces this owner's grants.
  const { name: pluginName, major } = parsePluginId(processing.pluginId)
  const ensured = await ensureArtefact({
    registryUrl: config.privateRegistryUrl,
    secretKey: config.secretKeys.registry,
    artefactId: pluginName,
    version: major,
    cacheDir: registryCacheDir,
    architecture: process.arch,
    account: {
      type: processing.owner.type,
      id: processing.owner.id,
      ...(processing.owner.department ? { department: processing.owner.department } : {})
    }
  })
  const pluginDir = ensured.path

  // Legacy plugin-config (deprecated, removed in v7.0): if dataDir is set the
  // legacy plugins volume is implicitly enabled — read the per-instance global
  // config keyed by the v5 id form.
  let pluginConfig: Record<string, unknown> = {}
  if (config.dataDir) {
    const legacyId = `${pluginName.replace('/', '-')}-${major}`
    const legacyConfigPath = path.join(config.dataDir, 'plugins', `${legacyId}-config.json`)
    if (await fs.pathExists(legacyConfigPath)) {
      pluginConfig = await fs.readJson(legacyConfigPath)
      await log.warning(`deprecation: plugin ${pluginName} still relies on legacy plugin-config from volume`)
    }
  }
  const dir = resolvePath(processingsDir, processing._id)
  await fs.ensureDir(dir)
  const tmpDir = await tmp.dir({ unsafeCleanup: true, tmpdir: config.tmpDir, prefix: `processing-run-${processing._id}-${run._id}` })
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
    pluginModule = await importPluginModule(pluginDir)
    process.chdir(dir)
    const result = await pluginModule.run(context)
    if (result?.deleteOnComplete) {
      await mongo.runs.updateOne({ _id: run._id }, { $set: { deleteOnComplete: true } })
    }
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
