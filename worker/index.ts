import log from '@data-fair/lib-node/log.js'
import { start, stop } from './src/worker.ts'

start().then(() => {}, err => {
  log.error('failure while starting the worker', { code: 'start-process', err })
  process.exit(1)
})

process.on('SIGTERM', function onSigterm () {
  log.info('received SIGTERM signal, shutting down gracefully...')
  stop().then(() => {
    log.info('shutting down now')
    process.exit()
  }, err => {
    log.error('failure while stopping the worker', { code: 'stop-process', err })
    process.exit(1)
  })
})
