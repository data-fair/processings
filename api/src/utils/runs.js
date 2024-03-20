import { createNext } from '../../../shared/runs.js'
import config from '../config.js'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'

const processingsDir = path.resolve(config.dataDir, 'processings')

/**
 * Stop all pending runs for a processing if it is deactivated
 * Cancel job that might have been scheduled previously if processing is set on manual trigger
 * @param {import('mongodb').Db} db
 * @param {import('../../../shared/types/processing/index.js').Processing} processing
 * @returns {Promise<void>} nothing
 */
export const applyProcessing = async (db, processing) => {
  // if processing is deactivated, cancel pending runs
  if (!processing.active) {
    await db.collection('processings')
      // @ts-ignore
      .updateOne({ _id: processing._id }, { $unset: { nextRun: '' } })
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing._id, status: { $in: ['scheduled', 'triggered'] } })
    return
  }

  // if processing is set on manual trigger, cancel job that might have been scheduled previously
  if (processing.scheduling.type === 'trigger') {
    await db.collection('processings')
      // @ts-ignore
      .updateOne({ _id: processing._id }, { $unset: { nextRun: '' } })
    await db.collection('runs')
      .deleteMany({ 'processing._id': processing._id, status: 'scheduled' })
    return
  }

  await createNext(db, processing)
}

/**
 * @param {import('mongodb').Db} db
 * @param {import('../../../shared/types/processing/index.js').Processing} processing
 * @returns {Promise<void>} nothing
 */
export const deleteProcessing = async (db, processing) => {
  await db.collection('runs').deleteMany({ 'processing._id': processing._id })
  await fs.remove(resolvePath(processingsDir, processing._id))
}

export default {
  applyProcessing,
  deleteProcessing
}
