import { incrementConsumption } from './limits.js'
import { runsMetrics } from './metrics.js'
import notifications from './notifications.js'

/**
 * @param {import('mongodb').Db} db
 * @param {(channel: string, data: any) => Promise<void>} wsPublish
 * @param {import('../../../shared/types/run/index.js').Run} run
 */
export const running = async (db, wsPublish, run) => {
  const patch = { status: 'running', startedAt: new Date().toISOString() }
  const lastRun = (await db.collection('runs').findOneAndUpdate(
    { _id: run._id },
    { $set: patch, $unset: { finishedAt: '' } },
    { returnDocument: 'after', projection: { log: 0, processing: 0, owner: 0 } }
  ))
  await wsPublish(`processings/${run.processing._id}/run-patch`, { _id: run._id, patch })
  await db.collection('processings')
    .updateOne({ _id: run.processing._id }, { $set: { lastRun }, $unset: { nextRun: '' } })
}

/**
 * Update the database when a run is finished (edit status, log, duration, etc.)
 * @param {import('mongodb').Db} db
 * @param {(channel: string, data: any) => Promise<void>} wsPublish
 * @param {import('../../../shared/types/run/index.js').Run} run
 * @param {string | undefined} errorMessage
 * @param {string} errorLogType
 * @returns {Promise<void>}
 */
export const finish = async (db, wsPublish, run, errorMessage = undefined, errorLogType = 'debug') => {
  /** @type {any} */
  const query = {
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
  let lastRun = (await db.collection('runs').findOneAndUpdate(
    // @ts-ignore
    { _id: run._id },
    query,
    { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
  ))
  if (!lastRun.startedAt) {
    lastRun = (await db.collection('runs').findOneAndUpdate(
      // @ts-ignore
      { _id: run._id },
      { $set: { startedAt: lastRun.finishedAt } },
      { returnDocument: 'after', projection: { processing: 0, owner: 0 } }
    ))
  }
  await wsPublish(`processings/${run.processing._id}/run-patch`, { _id: run._id, patch: query.$set })
  const duration = (new Date(lastRun.finishedAt).getTime() - new Date(lastRun.startedAt).getTime()) / 1000
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
    visibility: 'private'
  }
  if (lastRun.status === 'finished') {
    notifications.send({
      ...notif,
      topic: { key: `processings:processing-finish-ok:${run.processing._id}` },
      title: `Le traitement ${run.processing.title} a terminé avec succès`
    })
    const errorLogs = lastRun.log.filter((/** @type {any} */ l) => l.type === 'error')
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
        body: errorLogs.map((/** @type {any} */ l) => l.msg).join(' - '),
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
  delete lastRun.log
  await db.collection('processings').updateOne(
    // @ts-ignore
    { _id: run.processing._id },
    { $set: { lastRun } }
  )
}

export default {
  running,
  finish
}
