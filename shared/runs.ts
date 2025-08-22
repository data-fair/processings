import type { Db } from 'mongodb'
import type { Run, Processing, Scheduling } from '#api/types'
import type { Locks } from '@data-fair/lib-node/locks.js'
import { httpError } from '@data-fair/lib-utils/http-errors.js'

import { Cron } from 'croner'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import { assertValid } from '../api/types/run/index.ts'

export const toCRON = (scheduling: Scheduling): string => {
  const minute = scheduling.minute + (scheduling.minuteStep ? `/${scheduling.minuteStep}` : '')
  const hour = scheduling.hour + (scheduling.hourStep ? `/${scheduling.hourStep}` : '')
  const dayOfMonth = scheduling.lastDayOfMonth
    ? 'L'
    : scheduling.dayOfMonth + (scheduling.dayOfMonthStep ? `/${scheduling.dayOfMonthStep}` : '')
  const month = scheduling.month + (scheduling.monthStep ? `/${scheduling.monthStep}` : '')
  const dayOfWeek = scheduling.dayOfWeek
  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
}

export const createNext = async (db: Db, locks: Locks, processing: Processing, triggered: boolean = false, delaySeconds:number = 0): Promise<Run | null> => {
  const ack = await locks.acquire(processing._id + '/next-run')
  try {
    if (!ack) throw httpError(400, 'une planification est déjà en cours')
    if (await db.collection('runs').countDocuments({ 'processing._id': processing._id, status: 'running' }) > 0) {
      throw httpError(400, 'une exécution est déjà en cours')
    }

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
    } as Run

    const runsCollection = db.collection<Run>('runs')
    const processingsCollection = db.collection<Processing>('processings')

    // cancel one that might have been scheduled previously
    if (triggered) {
      await runsCollection.deleteMany({ 'processing._id': processing._id, status: { $in: ['triggered', 'scheduled'] } })
      await processingsCollection.updateOne({ _id: run.processing._id }, { $unset: { nextRun: 1 } })
      if (delaySeconds) {
        const scheduledAt = dayjs()
        scheduledAt.add(delaySeconds, 'seconds')
        run.scheduledAt = scheduledAt.toISOString()
      } else {
        run.scheduledAt = run.createdAt
      }
    } else {
      if (await db.collection('runs').countDocuments({ 'processing._id': processing._id, status: 'triggered' }) > 0) {
        throw httpError(400, 'une exécution manuelle est déjà demandée')
      }
      await runsCollection.deleteMany({ 'processing._id': processing._id, status: 'scheduled' })
      await processingsCollection.updateOne({ _id: run.processing._id }, { $unset: { nextRun: 1 } })
      let nextDate = null
      for (const scheduling of processing.scheduling) {
        const cron = toCRON(scheduling)
        const job = new Cron(cron, { timezone: scheduling.timeZone || 'Europe/Paris' })
        const nextDateCandidate = job.nextRun()
        if (!nextDateCandidate) {
          throw new Error('No next date returned for processing scheduling ' + JSON.stringify(scheduling))
        }
        if (!nextDate || nextDateCandidate < nextDate) {
          nextDate = nextDateCandidate
        }
      }

      if (nextDate) run.scheduledAt = nextDate.toISOString()
    }

    if (run.scheduledAt) {
      assertValid(run)
      await runsCollection.insertOne(run)
      const nextRun = {
        _id: run._id,
        createdAt: run.createdAt,
        status: run.status,
        permissions: run.permissions,
        scheduledAt: run.scheduledAt
      }

      await processingsCollection.updateOne(
        { _id: run.processing._id },
        { $set: { nextRun } }
      )
      return run
    } else {
      return null
    }
  } finally {
    await locks.release(processing._id + '/next-run')
  }
}
