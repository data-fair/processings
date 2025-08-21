import type { Account } from '@data-fair/lib-express'

import { getLimits } from '@data-fair/processings-shared/limits.ts'
import config from '#config'
import mongo from '#mongo'

const calculateRemainingLimit = (limits: any, key: string) => {
  const limit = limits && limits[key] && limits[key].limit
  if (limit === -1) return -1
  const consumption = (limits && limits[key] && limits[key].consumption) || 0
  return Math.max(0, limit - consumption)
}

export const remaining = async (consumer: Account) => {
  const limits = await getLimits(mongo.db, consumer, config.defaultLimits.processingsSeconds)
  return {
    processingsSeconds: calculateRemainingLimit(limits, 'processings_seconds')
  }
}

export const incrementConsumption = async (consumer: Account, type: string, inc: number) => {
  return (await mongo.limits.findOneAndUpdate({ type: consumer.type, id: consumer.id }, { $inc: { [`${type}.consumption`]: inc } }, { returnDocument: 'after', upsert: true }))
}

export default {
  remaining,
  incrementConsumption
}
