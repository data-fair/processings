const EventEmitter = require('node:events')
const config = require('config')
const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const tmp = require('tmp-promise')
const WebSocket = require('ws')
const resolvePath = require('resolve-path')
const runs = require('../utils/runs')
const { httpAgent, httpsAgent } = require('../utils/http-agents')

let pluginModule, _stopped

const processingsDir = path.join(config.dataDir, 'processings')

exports.run = async ({ db, mailTransport, wsPublish }) => {
  const [run, processing] = await Promise.all([
    db.collection('runs').findOne({ _id: process.argv[2] }),
    db.collection('processings').findOne({ _id: process.argv[3] })
  ])

  const pushLog = async (log) => {
    await db.collection('runs').updateOne({ _id: run._id }, { $push: { log } })
    await wsPublish(`processings/${processing._id}/run-log`, { _id: run._id, log })
  }

  const log = {
    async step (msg) {
      return pushLog({ type: 'step', date: new Date().toISOString(), msg })
    },
    async error (msg, extra) {
      return pushLog({ type: 'error', date: new Date().toISOString(), msg, extra })
    },
    async warning (msg, extra) {
      return pushLog({ type: 'warning', date: new Date().toISOString(), msg, extra })
    },
    async info (msg, extra) {
      return pushLog({ type: 'info', date: new Date().toISOString(), msg, extra })
    },
    async debug (msg, extra) {
      if (!processing.debug) return
      return pushLog({ type: 'debug', date: new Date().toISOString(), msg, extra })
    },
    async task (msg) {
      return pushLog({ type: 'task', date: new Date().toISOString(), msg })
    },
    async progress (msg, progress, total) {
      const progressDate = new Date().toISOString()
      await db.collection('runs')
        .updateOne({ _id: run._id, log: { $elemMatch: { type: 'task', msg } } },
          { $set: { 'log.$.progress': progress, 'log.$.total': total, 'log.$.progressDate': progressDate } })
      await wsPublish(`processings/${processing._id}/run-log`, { _id: run._id, log: { type: 'task', msg, progressDate, progress, total } })
    }
  }
  log.warn = log.warning
  if (run.status === 'running') {
    await log.step('Reprise après interruption.')
  }
  await runs.running(db, wsPublish, run)
  const pluginDir = path.resolve(config.dataDir, 'plugins', processing.plugin)

  let pluginConfig = {}
  if (await fs.pathExists(pluginDir + '-config.json')) {
    pluginConfig = await fs.readJson(pluginDir + '-config.json')
  }
  if (!await fs.pathExists(pluginDir + '/index.js')) {
    throw new Error('fichier source manquant : ' + pluginDir + '/index.js')
  }

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
    const isDataFairUrl = cfg.url.startsWith(config.dataFairUrl)
    if (isDataFairUrl) Object.assign(cfg.headers, headers)

    // use private data fair url if specified to prevent leaving internal infrastructure
    // except from GET requests so that they still appear in metrics
    // except if config.getFromPrivateDataFairUrl is set to true, then all requests are sent to the private url
    const usePrivate =
      config.privateDataFairUrl &&
      isDataFairUrl &&
      (config.getFromPrivateDataFairUrl || ['post', 'put', 'delete', 'patch'].includes(cfg.method))
    if (usePrivate) {
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

  const ws = new EventEmitter()
  ws._channels = []
  ws._connect = async () => {
    return new Promise((resolve, reject) => {
      const wsUrl = (config.privateDataFairUrl || config.dataFairUrl).replace('http://', 'ws://').replace('https://', 'wss://') + '/'
      log.debug(`connect Web Socket to ${wsUrl}`)
      ws._ws = new WebSocket(wsUrl)
      ws._ws.on('error', err => {
        log.debug('WS encountered an error', err.message)
        ws._reconnect()
        reject(err)
      })
      ws._ws.once('open', () => {
        log.debug('WS is opened')
        resolve(ws._ws)
      })
      ws._ws.on('message', (message) => {
        message = JSON.parse(message.toString())
        log.debug('received message', message)
        ws.emit('message', message)
      })
    })
  }
  ws._reconnect = async () => {
    log.debug('reconnect')
    ws._ws.terminate()
    await ws._connect()
    for (const channel of ws._channels) {
      await ws.subscribe(channel, true)
    }
  }
  ws.subscribe = async (channel, force = false, timeout = 2000) => {
    if (ws._channels.includes(channel) && !force) return
    if (!ws._ws) await ws._connect()
    return new Promise((resolve, reject) => {
      const _timeout = setTimeout(() => reject(new Error('timeout')), timeout)
      log.debug('subscribe to channel', channel)
      const subscribeMessage = { type: 'subscribe', channel, apiKey: config.dataFairAPIKey }
      if (config.dataFairAdminMode) subscribeMessage.account = JSON.stringify(processing.owner)
      ws._ws.send(JSON.stringify(subscribeMessage))
      ws.once('message', (message) => {
        if (message.channel && message.channel !== channel) return
        clearTimeout(_timeout)
        log.debug('received response to subscription', message)
        if (message.type === 'error') return reject(new Error(`${message.status} - ${message.data}`))
        else if (message.type === 'subscribe-confirm') return resolve()
        else return reject(new Error('expected a subscription confirmation, got ' + JSON.stringify(message)))
      })
      if (ws._channels.includes(channel)) ws._channels.push(channel)
    })
  }
  ws.waitFor = async (channel, filter, timeout = 300000) => {
    await ws.subscribe(channel)
    return new Promise((resolve, reject) => {
      const _timeout = setTimeout(() => reject(new Error('timeout')), timeout)
      const messageCb = (message) => {
        if (message.channel === channel && (!filter || filter(message.data))) {
          clearTimeout(_timeout)
          ws.off('message', messageCb)
          resolve(message.data)
        }
      }
      ws.on('message', messageCb)
    })
  }
  ws.waitForJournal = async (datasetId, eventType, timeout = 300000) => {
    await log.info(`attend l'évènement "${eventType}" sur le jeu de données "${datasetId}"`)
    const event = await ws.waitFor(`datasets/${datasetId}/journal`, (e) => e.type === eventType || e.type === 'error', timeout)
    if (event.type === 'error') throw new Error(event.data)
    return event
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
    axios: axiosInstance,
    ws,
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
    if (ws._ws) await ws._ws.terminate()
  }
}

exports.stop = async () => {
  _stopped = true
  if (pluginModule && pluginModule.stop) await pluginModule.stop()
  // grace period of 20s, either run() finishes in the interval or we shutdown
  await new Promise(resolve => setTimeout(resolve, config.worker.gracePeriod))
}
