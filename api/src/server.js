import { app } from './app.js'
import { startWSServer, stopWSServer } from './utils/wsServer.js'
import { session } from '@data-fair/lib/express/index.js'
import { startObserver, stopObserver } from '@data-fair/lib/node/observer.js'
import { createHttpTerminator } from 'http-terminator'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import config from './config.js'
import mongo from '@data-fair/lib/node/mongo.js'
import http from 'http'

const exec = promisify(execCallback)
const server = http.createServer(app)
const httpTerminator = createHttpTerminator({ server })

// cf https://connectreport.com/blog/tuning-http-keep-alive-in-node-js/
// timeout is often 60s on the reverse proxy, better to a have a longer one here
// so that interruption is managed downstream instead of here
server.keepAliveTimeout = (60 * 1000) + 1000
server.headersTimeout = (60 * 1000) + 2000

export const start = async () => {
  if (config.observer.active) await startObserver(config.observer.port)
  session.init(config.privateDirectoryUrl)
  await mongo.connect(config.mongoUrl, { readPreference: 'nearest', maxPoolSize: 1 })
  server.listen(config.port)
  await new Promise(resolve => server.once('listening', resolve))
  const npmHttpsProxy = config.npm?.httpsProxy || process.env.HTTPS_PROXY || process.env.https_proxy
  if (npmHttpsProxy) await exec('npm config set https-proxy ' + npmHttpsProxy)
  await startWSServer(server, mongo.db, session)

  console.log(`Processings API available on ${config.origin}/api/ (listening on port ${config.port})`)
}

export const stop = async () => {
  await httpTerminator.terminate()
  if (config.observer.active) await stopObserver()
  await mongo.client.close()
  await stopWSServer()
}

export const cleanDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    await mongo.db.collection('processings').deleteMany({})
    await mongo.db.collection('runs').deleteMany({})
    await mongo.db.collection('limits').deleteMany({})
  }
}
