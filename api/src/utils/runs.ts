import type { ProcessingsMongo } from '#mongo'
import type { Processing } from '#types/processing/index.ts'

import { createNext } from '@data-fair/processing-shared/runs.ts'
import config from '#config'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'
import locks from '#locks'

const processingsDir = path.resolve(config.dataDir, 'processings')

/**
 * Stop all pending runs for a processing if it is deactivated
 * Cancel job that might have been scheduled previously
 */
export const applyProcessing = async (mongo: ProcessingsMongo, processing: Processing) => {
  // if processing is deactivated, cancel pending runs
  if (!processing.active) {
    await mongo.processings.updateOne({ _id: processing._id }, { $unset: { nextRun: '' } })
    await mongo.runs.deleteMany({ 'processing._id': processing._id, status: { $in: ['scheduled', 'triggered'] } })
    return
  }

  try {
    await createNext(mongo.db, locks, processing)
  } catch (error) {
    console.error('Error creating next run', error)
  }
}

export const deleteProcessing = async (mongo: ProcessingsMongo, processing: Processing) => {
  await mongo.runs.deleteMany({ 'processing._id': processing._id })
  await fs.remove(resolvePath(processingsDir, processing._id))
}

export default {
  applyProcessing,
  deleteProcessing
}
