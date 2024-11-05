import type { UpgradeScript } from '@data-fair/lib-node/upgrade-scripts.js'

export default {
  description: 'Scheduling rules are now stored in an array',
  async exec (db, debug) {
    for await (const processing of db.collection('processings').find({})) {
      if (!Array.isArray(processing.scheduling)) {
        const scheduling = (!processing.scheduling || processing.scheduling.type === 'trigger') ? [] : [processing.scheduling]
        debug(`update scheduling of processing ${processing.title} (${processing._id})`, processing.scheduling, scheduling)
        await db.collection('processings').updateOne({ _id: processing._id }, { $set: { scheduling } })
      }
    }
  }
} as UpgradeScript
