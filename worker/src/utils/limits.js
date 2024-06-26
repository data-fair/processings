import { getLimits } from '../../../shared/limits.js'
import config from '../config.js'
import mongo from '@data-fair/lib/node/mongo.js'

export const initLimits = async () => {
  await mongo.ensureIndex('limits', { id: 'text', name: 'text' }, { name: 'fulltext' })
  await mongo.ensureIndex('limits', { type: 1, id: 1 }, { name: 'limits-find-current', unique: true })
}

const calculateRemainingLimit = (limits, key) => {
  const limit = limits && limits[key] && limits[key].limit
  if (limit === -1) return -1
  const consumption = (limits && limits[key] && limits[key].consumption) || 0
  return Math.max(0, limit - consumption)
}

export const remaining = async (db, consumer) => {
  const limits = await getLimits(db, consumer, config.defaultLimits.processingsSeconds)
  return {
    processingsSeconds: calculateRemainingLimit(limits, 'processings_seconds')
  }
}

export const incrementConsumption = async (db, consumer, type, inc) => {
  return (await db.collection('limits')
    .findOneAndUpdate({ type: consumer.type, id: consumer.id }, { $inc: { [`${type}.consumption`]: inc } }, { returnDocument: 'after', upsert: true }))
}

export default {
  initLimits,
  remaining,
  incrementConsumption
}
