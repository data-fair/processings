import type { Db } from 'mongodb'
import type { Run, Processing } from '#api/types'

import * as wsEmitter from '@data-fair/lib-node/ws-emitter.js'
import { incrementConsumption } from './limits.ts'
import { runsMetrics } from './metrics.ts'
import notifications from './notifications.ts'

export const running = async (db: Db, run: Run) => {
  const patch = { status: 'running' as Run['status'], startedAt: new Date().toISOString() }
  const lastRun = await db.collection<Run>('runs').findOneAndUpdate(
    { _id: run._id },
    { $set: patch, $unset: { finishedAt: '' } },
    { returnDocument: 'after', projection: { log: 0, processing: 0, owner: 0 } }
  )
  if (!lastRun) throw new Error('Run not found')
  await wsEmitter.emit(`processings/${run.processing._id}/run-patch`, { _id: run._id, patch })
  await db.collection<Processing>('processings')
    .updateOne({ _id: run.processing._id }, { $set: { lastRun }, $unset: { nextRun: '' } })
}

/**
 * Update the database when a run is finished (edit status, log, duration, etc.)
 */
export const finish = async (db: Db, run: Run, errorMessage: string | undefined = undefined, errorLogType: string = 'debug') => {
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
  let lastRun = (await db.collection<Run>('runs').findOneAndUpdate(
    { _id: run._id },
    query,
    { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
  )) as Run
  if (!lastRun.startedAt) {
    lastRun = (await db.collection<Run>('runs').findOneAndUpdate(
      { _id: run._id },
      { $set: { startedAt: lastRun.finishedAt } },
      { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
    )) as Run
  }
  await wsEmitter.emit(`processings/${run.processing._id}/run-patch`, { _id: run._id, patch: query.$set })
  const duration = (new Date(lastRun.finishedAt!).getTime() - new Date(lastRun.startedAt!).getTime()) / 1000
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
    visibility: 'private',
    recipient: run.owner,
    date: new Date().toISOString()
  }
  if (lastRun.status === 'finished') {
    notifications.send({
      ...notif,
      topic: { key: `processings:processing-finish-ok:${run.processing._id}` },
      title: `Le traitement ${run.processing.title} a terminé avec succès`
    })
    const errorLogs = lastRun.log.filter((l) => l.type === 'error')
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
        body: errorLogs.map((l) => l.msg).join(' - '),
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
  const processingLastRun: Omit<Run, 'log'> = lastRun
  delete processingLastRun.log
  await db.collection<Processing>('processings').updateOne(
    { _id: run.processing._id },
    { $set: { lastRun } }
  )
}

export default {
  running,
  finish
}
