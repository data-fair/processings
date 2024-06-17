import { start, stop } from './src/worker.js'

start().then(() => {}, err => {
  console.error('Failure while starting worker', err)
  process.exit(1)
})

process.on('SIGTERM', function onSigterm () {
  console.info('Received SIGTERM signal, shutdown gracefully...')
  stop().then(() => {
    console.log('shutting down now')
    process.exit()
  }, err => {
    console.error('Failure while stopping worker', err)
    process.exit(1)
  })
})
