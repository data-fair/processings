import mongo from '@data-fair/lib/node/mongo.js'
import nodemailer from 'nodemailer'
import { initPublisher } from '../../../shared/ws.mjs'
import config from 'config'
import { run } from './task.js'

(async () => {
  await mongo.connect(config.mongoUrl, { readPreference: 'primary' })
  const mailTransport = nodemailer.createTransport(config.mails.transport)
  const db = mongo.db
  const wsPublish = await initPublisher(db)
  const err = await run({ db, mailTransport, wsPublish })
  if (err) process.exit(-1)
})()
