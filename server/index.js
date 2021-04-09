
const config = require('config')
const mongodb = require('./utils/mongodb')
let _client

async function start () {
  let poolSize = 5
  let readPreference = 'primary' // better to prevent read before write cases in workers
  if (config.mode === 'server') {
    readPreference = 'nearest' // the Web API is not as sensitive to small freshness problems
  }
  if (config.mode === 'worker') {
    poolSize = 1
  }
  const { client, db } = await mongodb.init(poolSize, readPreference)
  _client = client
  if (config.mode.includes('worker')) {
    await require('../upgrade')(db)
    await require('./worker').start({ db })
  }
  if (config.mode.includes('server')) {
    await require('./app').start({ db })
  }
}

async function stop () {
  if (config.mode.includes('server')) await require('./app').stop()
  if (config.mode.includes('worker')) await require('./worker').stop()
  if (_client) await _client.close()
}

start().then(() => {}, err => {
  console.error('Failure', err)
  process.exit(-1)
})

process.on('SIGTERM', function onSigterm () {
  console.info('Received SIGTERM signal, shutdown gracefully...')
  stop().then(() => {
    console.log('shutting down now')
    process.exit()
  }, err => {
    console.error('Failure while stopping', err)
    process.exit(-1)
  })
})
