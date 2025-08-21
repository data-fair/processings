import type { Run } from '#api/types'

import * as wsEmitter from '@data-fair/lib-node/ws-emitter.js'
import { incrementConsumption } from './limits.ts'
import { runsMetrics } from './metrics.ts'
import eventsQueue from '@data-fair/lib-node/events-queue.js'
import config from '#config'
import mongo from '#mongo'
import { internalError } from '@data-fair/lib-node/observer.js'

const sendProcessingEvent = (
  run: Run,
  statusText: string,
  statusKey: string,
  body?: string
) => {
  // @test:spy("pushEvent", `processings:processing-${statusKey}:${run.processing._id}`)
  if (!config.privateEventsUrl && !config.secretKeys.events) return

  eventsQueue.pushEvent({
    title: `Le traitement ${run.processing.title} ${statusText}.`,
    topic: { key: `processings:processing-${statusKey}:${run.processing._id}` },
    sender: run.owner,
    body,
    visibility: 'private',
    resource: {
      type: 'processing',
      id: run.processing._id,
      title: 'Traitement associé : ' + run.processing.title,
    },
    originator: {
      internalProcess: {
        id: 'processings-worker',
        name: 'Processings Worker'
      }
    }
  })
}

export const running = async (run: Run) => {
  const patch = { status: 'running' as Run['status'], startedAt: new Date().toISOString() }
  const lastRun = await mongo.runs.findOneAndUpdate(
    { _id: run._id },
    { $set: patch, $unset: { finishedAt: '' } },
    { returnDocument: 'after', projection: { log: 0, processing: 0, owner: 0 } }
  )
  if (!lastRun) throw new Error('Run not found')
  await wsEmitter.emit(`processings/${run.processing._id}/run-patch`, { _id: run._id, patch })
  await mongo.processings
    .updateOne({ _id: run.processing._id }, { $set: { lastRun }, $unset: { nextRun: '' } })
}

/**
 * Update the database when a run is finished (edit status, log, duration, etc.)
 */
export const finish = async (run: Run, errorMessage: string | undefined = undefined, errorLogType: string = 'debug') => {
  const query: Record<string, any> = {
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
  let lastRun = (await mongo.runs.findOneAndUpdate(
    { _id: run._id },
    query,
    { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
  ))
  if (!lastRun) return internalError('processing-worker', 'Last run not found after finish update')
  if (!lastRun.startedAt) {
    lastRun = (await mongo.runs.findOneAndUpdate(
      { _id: run._id },
      { $set: { startedAt: lastRun.finishedAt } },
      { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
    ))
    if (!lastRun) return internalError('processing-worker', 'Last run not found after startedAt update')
  }
  await wsEmitter.emit(`processings/${run.processing._id}/run-patch`, { _id: run._id, patch: query.$set })
  const duration = (new Date(lastRun.finishedAt!).getTime() - new Date(lastRun.startedAt!).getTime()) / 1000
  runsMetrics.labels(({ status: query.$set.status, owner: run.owner.name })).observe(duration)
  await incrementConsumption(run.owner, 'processings_seconds', Math.round(duration))

  if (lastRun.status === 'finished') {
    const errorLogs = lastRun.log.filter((l) => l.type === 'error')
    if (errorLogs.length) {
      sendProcessingEvent(run, 's\'est terminé correctement mais son journal contient des erreurs', 'log-error', errorLogs.map((l) => l.msg).join(' - '))
    } else {
      sendProcessingEvent(run, 's\'est terminé sans erreurs', 'finish-ok')
    }
  } else if (lastRun.status === 'error') {
    sendProcessingEvent(run, 'a échoué', 'finish-error', errorMessage)

    const reachedMaxFailures = (await mongo.runs.aggregate([
      { $match: { 'processing._id': run.processing._id } }, // filter by processing
      { $sort: { finishedAt: -1 } },                        // sort by finishedAt descending (most recent first)
      { $limit: config.maxFailures },                       // take the last X runs
      {
        $group: {                                          // aggregate
          _id: null,
          total: { $sum: 1 },                              // count total runs in this slice
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } } // count runs with status 'error'
        }
      },
      {
        $project: {
          allErrors: { $eq: [config.maxFailures, '$errors'] }       // true if all X runs are errors
        }
      }
    ]).toArray())[0]?.allErrors ?? false

    // Disable processing if reached max failures
    if (reachedMaxFailures) {
      await mongo.processings.updateOne(
        { _id: run.processing._id },
        { $set: { active: false } }
      )
      sendProcessingEvent(run, `a été désactivé car il a échoué ${config.maxFailures} fois de suite`, 'disabled')
    }
  }

  // store the newly closed run as processing.lastRun for convenient access
  const processingLastRun: Omit<Run, 'log'> = lastRun
  delete processingLastRun.log
  await mongo.processings.updateOne(
    { _id: run.processing._id },
    { $set: { lastRun } }
  )

  // remove old runs
  await mongo.runs.deleteMany({
    'processing._id': run.processing._id,
    _id: {
      $in: await mongo.runs
        .find({ 'processing._id': run.processing._id })
        .sort({ createdAt: -1 })
        .skip(config.runsRetention)
        .project({ _id: 1 })
        .map(d => d._id)
        .toArray()
    }
  })
}

export default {
  running,
  finish
}
