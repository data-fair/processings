import notifications from './notifications.js'
import { incrementConsumption } from './limits.js'
import { runsMetrics } from './metrics.js'
import { nanoid } from 'nanoid'
import config from 'config'
import moment from 'moment'
import { CronJob } from 'cron'
import schedulingUtils from '../../../api/src/utils/scheduling.cjs'
import runSchema from '../../../contract/run.js'

import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'

const ajv = ajvFormats(new Ajv({ strict: false }))
const validate = ajv.compile(runSchema)

export const running = async (db, wsPublish, run) => {
  const patch = { status: 'running', startedAt: new Date().toISOString() }
  const lastRun = (await db.collection('runs').findOneAndUpdate(
    { _id: run._id },
    { $set: patch, $unset: { finishedAt: '' } },
    { returnDocument: 'after', projection: { log: 0, processing: 0, owner: 0 } }
  ))
  await wsPublish(`processings/${run.processing._id}/run-patch`, { _id: run._id, patch })
  await db.collection('processings')
    .updateOne({ _id: run.processing._id }, { $set: { lastRun }, $unset: { nextRun: '' } })
}

export const finish = async (db, wsPublish, run, errorMessage, errorLogType = 'debug') => {
  const query = {
    $set: {
      status: 'finished',
      finishedAt: new Date().toISOString()
    }
  }
  if (run.status === 'killed') query.$set.status = 'killed'
  else if (errorMessage) {
    query.$set.status = 'error'
    query.$push = { log: { type: errorLogType, msg: errorMessage, date: new Date().toISOString() } }
  }
  let lastRun = (await db.collection('runs').findOneAndUpdate(
    { _id: run._id },
    query,
    { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
  ))
  if (!lastRun.startedAt) {
    lastRun = (await db.collection('runs').findOneAndUpdate(
      { _id: run._id },
      { $set: { startedAt: lastRun.finishedAt } },
      { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
    ))
  }
  await wsPublish(`processings/${run.processing._id}/run-patch`, { _id: run._id, patch: query.$set })
  const duration = (new Date(lastRun.finishedAt).getTime() - new Date(lastRun.startedAt).getTime()) / 1000
  runsMetrics.labels(({ status: query.$set.status, owner: run.owner.name })).observe(duration)
  await incrementConsumption(db, run.owner, 'processings_seconds', Math.round(duration))

  // manage post run notification
  const sender = { ...run.owner }
  delete sender.role
  delete sender.department
  delete sender.dflt
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

export const createNext = async (db, processing, triggered, delaySeconds = 0) => {
  const run = {
    _id: nanoid(),
    owner: processing.owner,
    processing: {
      _id: processing._id,
      title: processing.title
    },
    createdAt: new Date().toISOString(),
    status: triggered ? 'triggered' : 'scheduled',
    log: [],
    permissions: processing.permissions || []
  }

  // cancel one that might have been scheduled previously
  if (triggered) {
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing._id, status: { $in: ['triggered', 'scheduled'] } })
    if (delaySeconds) {
      const scheduledAt = moment()
      scheduledAt.add(delaySeconds, 'seconds')
      run.scheduledAt = scheduledAt.toISOString()
    } else {
      run.scheduledAt = run.createdAt
    }
  } else {
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing._id, status: 'scheduled' })
    const cron = schedulingUtils.toCRON(processing.scheduling)
    const timeZone = processing.scheduling.timeZone || config.defaultTimeZone
    const job = new CronJob(cron, () => {}, () => {}, false, timeZone)
    const nextDate = job.nextDates()
    run.scheduledAt = nextDate.toISOString()
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

export default {
  running,
  finish,
  createNext
}
