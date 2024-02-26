import config from 'config'
import path from 'path'
import fs from 'fs-extra'
import { CronJob } from 'cron'
import { nanoid } from 'nanoid'
import resolvePath from 'resolve-path'
import runSchema from '../../../contract/run.js'
import schedulingUtils from './scheduling.cjs'
import moment from 'moment'
import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'

const ajv = ajvFormats(new Ajv({ strict: false }))
const validate = ajv.compile(runSchema)

const processingsDir = path.resolve(config.dataDir, 'processings')

export const applyProcessing = async (db, processing) => {
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

  await createNext(db, processing)
}

export const deleteProcessing = async (db, processing) => {
  await db.collection('runs').deleteMany({ 'processing._id': processing._id })
  await fs.remove(resolvePath(processingsDir, processing._id))
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
  applyProcessing,
  deleteProcessing,
  createNext
}
