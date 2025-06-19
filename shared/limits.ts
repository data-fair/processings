import type { Limit } from '#api/types'
import type { Account } from '@data-fair/lib-common-types/session/index.js'
import type { Collection, Db } from 'mongodb'

export const getLimits = async (db: Db, consumer: Account, processingsSeconds:number = -1) => {
  const now = new Date()
  const limitsCollection = db.collection<Limit>('limits') as Collection<Limit>
  let limits = await limitsCollection.findOne({ type: consumer.type, id: consumer.id }) as Limit
  if (!limits) {
    limits = {
      type: consumer.type,
      id: consumer.id,
      name: consumer.name || consumer.id,
      lastUpdate: now.toISOString(),
      defaults: true
    }
    try {
      await limitsCollection.insertOne(limits)
    } catch (err: any) {
      if (err.code !== 11000) throw err
    }
  }
  limits.processings_seconds = limits.processings_seconds || { consumption: 0 }
  if (limits.processings_seconds.limit === undefined || limits.processings_seconds.limit === null) limits.processings_seconds.limit = processingsSeconds
  return limits
}
