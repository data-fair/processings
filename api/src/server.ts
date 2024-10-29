import { existsSync } from 'fs'
import resolvePath from 'resolve-path'
import { app } from './app.js'
import { startWSServer, stopWSServer } from './utils/wsServer.js'
import { session } from '@data-fair/lib-express/index.js'
import { startObserver, stopObserver } from '@data-fair/lib-node/observer.js'
import * as locks from '@data-fair/lib-node/locks.js'
import { createHttpTerminator } from 'http-terminator'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import config from './config.ts'
import mongo from './mongo.ts'
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
  if (!existsSync(config.dataDir) && process.env.NODE_ENV === 'production') {
    throw new Error(`Data directory ${resolvePath(config.dataDir)} was not mounted`)
  }
  if (config.observer.active) await startObserver(config.observer.port)
  session.init(config.privateDirectoryUrl)
  await mongo.init()
  await locks.init(mongo.db)

  server.listen(config.port)
  await new Promise(resolve => server.once('listening', resolve))
  const npmHttpsProxy = config.npm?.httpsProxy || process.env.HTTPS_PROXY || process.env.https_proxy
  if (npmHttpsProxy) await exec('npm --workspaces=false --include-workspace-root config set https-proxy ' + npmHttpsProxy)
  await startWSServer(server, mongo.db, session)

  console.log(`
  API server listening on port ${config.port}
  API available at ${config.origin}/processings/api/
  UI available at ${config.origin}/processings/`)
}

export const stop = async () => {
  await httpTerminator.terminate()
  if (config.observer.active) await stopObserver()
  await locks.stop()
  await mongo.client.close()
  await stopWSServer()
}
