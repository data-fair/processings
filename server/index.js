const exec = require('util').promisify(require('child_process').exec)
const config = require('config')
const nodemailer = require('nodemailer')
const dbUtils = require('./utils/db')
const prometheus = require('./utils/prometheus')
const wsUtils = require('./utils/ws')

let _client, _stopped

async function start () {
  let poolSize = 5
  let readPreference = 'primary' // better to prevent read before write cases in workers
  if (config.mode === 'server') {
    readPreference = 'nearest' // the Web API is not as sensitive to small freshness problems
  }
  if (config.mode === 'worker' || config.mode === 'task') {
    poolSize = 1 // no need for much concurrency inside worker/tasks
  }
  const { client, db } = await dbUtils.init(poolSize, readPreference)
  const wsPublish = await wsUtils.initPublisher(db)
  _client = client
  if (config.mode === 'task') {
    const mailTransport = nodemailer.createTransport(config.mails.transport)
    const err = await require('./worker/task').run({ db, mailTransport, wsPublish })
    if (err) process.exit(-1)
    if (_stopped) process.exit(143)
    process.exit()
  } else if (config.prometheus.active) {
    await prometheus.start(db)
  }

  const npmHttpsProxy = config.npm.httpsProxy || process.env.HTTPS_PROXY || process.env.https_proxy
  if (npmHttpsProxy) await exec('npm config set https-proxy ' + npmHttpsProxy)

  if (config.mode.includes('worker')) {
    await require('../upgrade')(db)
    require('./worker').start({ db, wsPublish })
  }
  if (config.mode.includes('server')) {
    await require('./app').start({ db, wsPublish })
  }
}

async function stop () {
  _stopped = true
  if (config.mode.includes('server')) await require('./app').stop()
  if (config.mode.includes('worker')) await require('./worker').stop()
  if (config.mode === 'task') await require('./worker/task').stop()
  else if (config.prometheus.active) await prometheus.stop()
  if (_client) await _client.close()
}

start().then(() => {}, err => {
  console.error('Failure', err)
  process.exit(1)
})

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
