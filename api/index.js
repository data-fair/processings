import { start, stop } from './src/server.js'

start()

process.on('SIGTERM', function onSigterm () {
  console.info('Received SIGTERM signal, shutdown gracefully...')
  stop().then(() => {
    console.log('shutting down now')
    process.exit(143)
  }, err => {
    console.error('Failure while stopping', err)
    process.exit(1)
  })
})
