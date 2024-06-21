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
  /** @type {import('mongodb').Collection<import('../../../shared/types/processing/index.js').Processing>} */
  const processingsCollection = db.collection('processings')
  const runsCollection = db.collection('runs')

  // if processing is deactivated, cancel pending runs
  if (!processing.active) {
    await processingsCollection.updateOne({ _id: processing._id }, { $unset: { nextRun: '' } })
    await runsCollection.deleteMany({ 'processing._id': processing._id, status: { $in: ['scheduled', 'triggered'] } })
    return
  }

  // if processing is set on manual trigger, cancel job that might have been scheduled previously
  if (processing.scheduling.type === 'trigger') {
    await processingsCollection.updateOne({ _id: processing._id }, { $unset: { nextRun: '' } })
    await runsCollection.deleteMany({ 'processing._id': processing._id, status: 'scheduled' })
    return
  }
  try {
    await createNext(db, processing)
  } catch (error) {
    console.error('Error creating next run', error)
  }
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
