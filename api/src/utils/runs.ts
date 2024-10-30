import type { ProcessingsMongo } from '#mongo'
import type { Processing } from '#types/processing/index.ts'

import { createNext } from '../../../shared/runs.js'
import config from '../config.js'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'

const processingsDir = path.resolve(config.dataDir, 'processings')

/**
 * Stop all pending runs for a processing if it is deactivated
 * Cancel job that might have been scheduled previously
 */
export const applyProcessing = async (db: ProcessingsMongo, processing: Processing) => {
  // if processing is deactivated, cancel pending runs
  if (!processing.active) {
    await db.processings.updateOne({ _id: processing._id }, { $unset: { nextRun: '' } })
    await db.runs.deleteMany({ 'processing._id': processing._id, status: { $in: ['scheduled', 'triggered'] } })
    return
  }

  try {
    await createNext(db, processing)
  } catch (error) {
    console.error('Error creating next run', error)
  }
}

export const deleteProcessing = async (db: ProcessingsMongo, processing: Processing) => {
  await db.runs.deleteMany({ 'processing._id': processing._id })
  await fs.remove(resolvePath(processingsDir, processing._id))
}

export default {
  applyProcessing,
  deleteProcessing
}
