import { toCRON } from './scheduling.js'
import { runType } from './types/index.js'
import * as locks from '@data-fair/lib/node/locks.js'
import { CronJob } from 'cron'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'

/**
 * @param {import('mongodb').Db} db
 * @param {import('./types/processing/index.js').Processing} processing
 * @param {boolean} triggered
 * @param {number} delaySeconds
 * @returns {Promise<import('./types/run/index.js').Run>}
 */
export const createNext = async (db, processing, triggered = false, delaySeconds = 0) => {
  const ack = await locks.acquire(processing._id + '/next-run', 'worker-loop-kill')
  try {
    if (!ack) {
      throw new Error('une planification est déjà en cours')
    }
    if (await db.collection('runs').countDocuments({ 'processing._id': processing._id, status: 'running' }) > 0) {
      throw new Error('une exécution est déjà en cours')
    }

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

    /** @type {import('mongodb').Collection<import('./types/run/index.js').Run>} */
    const runsCollection = db.collection('runs')
    // cancel one that might have been scheduled previously
    if (triggered) {
      await runsCollection.deleteMany({ 'processing._id': processing._id, status: { $in: ['triggered', 'scheduled'] } })
      if (delaySeconds) {
        const scheduledAt = dayjs()
        scheduledAt.add(delaySeconds, 'seconds')
        run.scheduledAt = scheduledAt.toISOString()
      } else {
        run.scheduledAt = run.createdAt
      }
    } else {
      if (await db.collection('runs').countDocuments({ 'processing._id': processing._id, status: 'triggered' }) > 0) {
        throw new Error('une exécution manuelle est déjà demandée')
      }
      await runsCollection.deleteMany({ 'processing._id': processing._id, status: 'scheduled' })
      const cron = toCRON(processing.scheduling)
      const timeZone = processing.scheduling.timeZone || 'Europe/Paris'
      const job = new CronJob(cron, () => { }, () => { }, false, timeZone)
      const nextDate = job.nextDate()?.toJSDate()
      if (!nextDate) {
        throw new Error('No next date returned for processing scheduling ' + processing.scheduling)
      }
      run.scheduledAt = nextDate.toISOString()
    }

    runType.assertValid(run)
    await runsCollection.insertOne(run)
    const nextRun = {
      _id: run._id,
      createdAt: run.createdAt,
      status: run.status,
      permissions: run.permissions,
      scheduledAt: run.scheduledAt
    }

    /** @type {import('mongodb').Collection<import('./types/processing/index.js').Processing>} */
    const processingsCollection = db.collection('processings')
    await processingsCollection.updateOne(
      { _id: run.processing._id },
      { $set: { nextRun } }
    )
    return run
  } finally {
    await locks.release(processing._id + '/next-run')
  }
}
