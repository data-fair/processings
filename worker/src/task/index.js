import mongo from '@data-fair/lib/node/mongo.js'
import nodemailer from 'nodemailer'
import { initPublisher } from '../../../shared/ws.js'
import config from '../config.js'
import { run, stop } from './task.js'

await mongo.connect(config.mongoUrl, { readPreference: 'primary' })
const mailTransport = nodemailer.createTransport(config.mails.transport)
const wsPublish = await initPublisher(mongo.db)

await run(mongo.db, mailTransport, wsPublish).then(async () => {
  await mongo.client.close()
  process.exit(0)
}).catch(() => { process.exit(-1) })

process.on('SIGTERM', function onSigterm () {
  console.info('Received SIGTERM signal, shutdown gracefully...')
  stop().then(() => {
    console.log('shutting down now')
    process.exit(143)
  }, err => {
    console.error('Failure while stopping task', err)
    process.exit(1)
  })
})
