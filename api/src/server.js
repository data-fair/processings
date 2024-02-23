import http from 'http'
import { createHttpTerminator } from 'http-terminator'
import config from 'config'
import { session } from '@data-fair/lib/express/index.js'
import { startObserver, stopObserver } from '@data-fair/lib/node/observer.js'
import mongo from '@data-fair/lib/node/mongo.js'
import { app } from './app.js'
import { initWSS, stopWSS } from './utils/wss.js'

const server = http.createServer(app)
const httpTerminator = createHttpTerminator({ server })

server.keepAliveTimeout = (60 * 1000) + 1000
server.headersTimeout = (60 * 1000) + 2000

export const start = async () => {
  await session.init(config.directoryUrl)
  const url = config.mongo.url || `mongodb://${config.mongo.host}:${config.mongo.port}/${config.mongo.db}`
  await mongo.connect(url, { readPreference: 'nearest', maxPoolSize: 1 })
  if (config.prometheus.active) await startObserver()
  await initWSS(server, mongo.db, session)
  server.listen(config.port)
  await new Promise(resolve => server.once('listening', resolve))
  console.log(`Processings API available on ${config.publicUrl}/api/ (listening on port ${config.port})`)
}

export const stop = async () => {
  await httpTerminator.terminate()
  await mongo.client.close()
  if (config.prometheus.active) await stopObserver()
  await stopWSS()
}
