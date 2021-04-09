const CronJob = require('cron').CronJob
const { nanoid } = require('nanoid')
const ajv = require('ajv')()
const runSchema = require('../../contract/run')
const validate = ajv.compile(runSchema)
const schedulingUtils = require('./scheduling')

exports.applyProcessing = async (db, processing) => {
  // if processing is deactivated, cancel pending runs
  if (!processing.active) {
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing.id, status: { $in: ['scheduled', 'triggered'] } })
    return
  }

  // if processing is set on manual trigger, cancel job that might have been scheduled previously
  if (processing.scheduling.type === 'trigger') {
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing.id, status: 'scheduled' })
    return
  }

  await exports.createNext(db, processing)
}

exports.createNext = async (db, processing) => {
  // cancel one that might have been scheduled previously
  await db.collection('runs')
    .deleteMany({ 'processing._id': processing.id, status: 'scheduled' })

  const cron = schedulingUtils.toCRON(processing.scheduling)
  const job = new CronJob(cron, () => {})
  const run = {
    _id: nanoid(),
    owner: processing.owner,
    processing: {
      _id: processing._id,
      title: processing.title,
    },
    createdAt: new Date().toISOString(),
    status: 'scheduled',
    scheduledAt: job.nextDates().toISOString(),
    log: [],
  }
  const valid = validate(run)
  if (!valid) throw new Error(JSON.stringify(validate.errors))
  await db.collection('runs').insertOne(run)
}

exports.deleteProcessing = async (db, processing) => {
  await db.collection('runs').deleteMany({ 'processing._id': processing.id })
}
