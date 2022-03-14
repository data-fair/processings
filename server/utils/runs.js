const config = require('config')
const path = require('path')
const fs = require('fs-extra')
const CronJob = require('cron').CronJob
const { nanoid } = require('nanoid')
const ajv = require('ajv')()
const runSchema = require('../../contract/run')
const validate = ajv.compile(runSchema)
const schedulingUtils = require('./scheduling')
const notifications = require('./notifications')

exports.applyProcessing = async (db, processing) => {
  // if processing is deactivated, cancel pending runs
  if (!processing.active) {
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing._id, status: { $in: ['scheduled', 'triggered'] } })
    return
  }

  // if processing is set on manual trigger, cancel job that might have been scheduled previously
  if (processing.scheduling.type === 'trigger') {
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing._id, status: 'scheduled' })
    return
  }

  await exports.createNext(db, processing)
}

exports.deleteProcessing = async (db, processing) => {
  await db.collection('runs').deleteMany({ 'processing._id': processing._id })
  await fs.remove(path.resolve(config.dataDir, 'processings', processing._id))
}

exports.createNext = async (db, processing, triggered) => {
  const run = {
    _id: nanoid(),
    owner: processing.owner,
    processing: {
      _id: processing._id,
      title: processing.title
    },
    createdAt: new Date().toISOString(),
    status: triggered ? 'triggered' : 'scheduled',
    log: []
  }

  // cancel one that might have been scheduled previously
  if (triggered) {
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing._id, status: { $in: ['triggered', 'scheduled'] } })
  } else {
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing._id, status: 'scheduled' })
    const cron = schedulingUtils.toCRON(processing.scheduling)
    const job = new CronJob(cron, () => {})
    run.scheduledAt = job.nextDates().toISOString()
  }

  const valid = validate(run)
  if (!valid) throw new Error(JSON.stringify(validate.errors))
  await db.collection('runs').insertOne(run)
  const { log, processing: _processing, owner, ...nextRun } = run
  await db.collection('processings').updateOne(
    { _id: run.processing._id },
    { $set: { nextRun } }
  )
  return run
}

exports.running = async (db, run) => {
  const lastRun = (await db.collection('runs').findOneAndUpdate(
    { _id: run._id },
    { $set: { status: 'running', startedAt: new Date().toISOString() }, $unset: { finishedAt: '' } },
    { returnDocument: 'after', projection: { log: 0, processing: 0, owner: 0 } }
  )).value
  await db.collection('processings')
    .updateOne({ _id: run.processing._id }, { $set: { lastRun }, $unset: { nextRun: '' } })
}

exports.finish = async (db, run, errorMessage) => {
  const query = {
    $set: {
      status: 'finished',
      finishedAt: new Date().toISOString()
    }
  }
  if (run.status === 'killed') query.$set.status = 'killed'
  else if (errorMessage) {
    query.$set.status = 'error'
    query.$push = { log: { type: 'debug', msg: errorMessage } }
  }
  const lastRun = (await db.collection('runs').findOneAndUpdate(
    { _id: run._id },
    query,
    { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
  )).value

  // manage post run notification
  const sender = { ...run.owner }
  delete sender.role
  delete sender.department
  const notif = {
    sender,
    urlParams: { id: run.processing._id },
    visibility: 'private'
  }
  if (lastRun.status === 'finished') {
    notifications.send({
      ...notif,
      topic: { key: `processings:processing-finish-ok:${run.processing._id}` },
      title: `Le traitement ${run.processing.title} a terminé avec succès`
    })
    const errorLogs = lastRun.log.filter(l => l.type === 'error')
    if (errorLogs.length) {
      let htmlBody = '<ul>'
      for (const errorLog of errorLogs) {
        htmlBody += `<li>${errorLog.msg}</li>`
      }
      htmlBody += '</ul>'
      notifications.send({
        ...notif,
        topic: { key: `processings:processing-log-error:${run.processing._id}` },
        title: `Le traitement ${run.processing.title} a terminé correctement mais son journal contient des erreurs`,
        body: errorLogs.map(l => l.msg).join(' - '),
        htmlBody
      })
    }
  }
  if (lastRun.status === 'error') {
    notifications.send({
      ...notif,
      topic: { key: `processings:processing-finish-error:${run.processing._id}` },
      title: `Le traitement ${run.processing.title} a terminé en échec`,
      body: errorMessage
    })
  }

  // store the newly closed run as processing.lastRun for convenient access
  delete lastRun.log
  await db.collection('processings')
    .updateOne({ _id: run.processing._id }, { $set: { lastRun } })
}
