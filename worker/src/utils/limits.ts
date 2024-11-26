import type { Account } from '@data-fair/lib-express'
import type { Db } from 'mongodb'

import { getLimits } from '@data-fair/processing-shared/limits.ts'
import config from '#config'

const calculateRemainingLimit = (limits: any, key: string) => {
  const limit = limits && limits[key] && limits[key].limit
  if (limit === -1) return -1
  const consumption = (limits && limits[key] && limits[key].consumption) || 0
  return Math.max(0, limit - consumption)
}

export const remaining = async (db: Db, consumer: Account) => {
  const limits = await getLimits(db, consumer, config.defaultLimits.processingsSeconds)
  return {
    processingsSeconds: calculateRemainingLimit(limits, 'processings_seconds')
  }
}

export const incrementConsumption = async (db: Db, consumer: Account, type: string, inc: number) => {
  return (await db.collection('limits')
    .findOneAndUpdate({ type: consumer.type, id: consumer.id }, { $inc: { [`${type}.consumption`]: inc } }, { returnDocument: 'after', upsert: true }))
}

export default {
  remaining,
  incrementConsumption
}
