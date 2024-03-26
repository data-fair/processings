import { toCRON } from './scheduling.js'
import { runType } from './types/index.js'
import { CronJob } from 'cron'
import { nanoid } from 'nanoid'
import moment from 'moment'

/**
 * @param {import('mongodb').Db} db
 * @param {import('./types/processing/index.js').Processing} processing
 * @param {boolean} triggered
 * @returns {Promise<import('./types/run/index.js').Run>}
 */
export const createNext = async (db, processing, triggered = false, delaySeconds = 0) => {
  /** @type {import('./types/run/index.js').Run} */
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
    const cron = toCRON(processing.scheduling)
    const timeZone = processing.scheduling.timeZone || 'Europe/Paris'
    const job = new CronJob(cron, () => { }, () => { }, false, timeZone)
    const nextDate = job.nextDates()
    run.scheduledAt = nextDate.toISOString()
  }

  runType.assertValid(run)
  // @ts-ignore run is a valid document
  await db.collection('runs').insertOne(run)
  const nextRun = {
    _id: run._id,
    createdAt: run.createdAt,
    status: run.status,
    permissions: run.permissions,
    scheduledAt: run.scheduledAt
  }
  await db.collection('processings').updateOne(
    // @ts-ignore _id is a valid id
    { _id: run.processing._id },
    { $set: { nextRun } }
  )
  return run
}