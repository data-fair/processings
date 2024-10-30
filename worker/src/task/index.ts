import mongo from '@data-fair/lib-node/mongo.js'
import nodemailer from 'nodemailer'
import { initPublisher } from '../../../shared/ws.js'
import config from '#config'
import { run, stop } from './task.ts'

let exitCode = 0

process.on('SIGTERM', function onSigterm () {
  console.info('Received SIGTERM signal, shutdown gracefully...')
  exitCode = 143
  stop().then(() => {
    // we will enter here only if run() did not return before the end of the grace period
    console.log('shutting down now')
    process.exit(143)
  }, err => {
    console.error('Failure while stopping task', err)
    process.exit(1)
  })
})

await mongo.connect(config.mongoUrl, { readPreference: 'primary', maxPoolSize: 1 })
const mailTransport = nodemailer.createTransport(config.mails.transport)
const wsPublish = await initPublisher(mongo.db)

const err = await run(mongo.db, mailTransport, wsPublish)
if (err) exitCode = 1
await mongo.client.close()
mailTransport.close()

process.exit(exitCode)
