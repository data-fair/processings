import log from '@data-fair/lib-node/log.js'
import { start, stop } from './src/server.ts'

start().then(() => {}, err => {
  log.error('failure while starting the service', { code: 'start-process', err })
  process.exit(1)
})

process.on('SIGTERM', function onSigterm () {
  log.info('received SIGTERM signal, shutting down gracefully...')
  stop().then(() => {
    log.info('shutting down now')
    process.exit()
  }, err => {
    log.error('failure while stopping the service', { code: 'stop-process', err })
    process.exit(1)
  })
})
