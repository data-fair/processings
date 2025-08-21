import * as wsEmitter from '@data-fair/lib-node/ws-emitter.js'
import nodemailer from 'nodemailer'
import config from '#config'
import mongo from '#mongo'
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

await mongo.init()
const mailTransport = nodemailer.createTransport(config.mails.transport)
await wsEmitter.init(mongo.db)

const err = await run(mailTransport)
if (err) exitCode = 1
await mongo.close()
mailTransport.close()

process.exit(exitCode)
