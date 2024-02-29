import config from '../config.js'
import mongo from '@data-fair/lib/node/mongo.js'
import { getLimits } from '../../../shared/limits.js'

export const initLimits = async () => {
  await mongo.ensureIndex('limits', { id: 'text', name: 'text' }, { name: 'fulltext' })
  await mongo.ensureIndex('limits', { type: 1, id: 1 }, { name: 'limits-find-current', unique: true })
}

export const get = async (db, consumer, type) => {
  const limits = await getLimits(db, consumer, config.defaultLimits.processingsSeconds)
  const res = (limits && limits[type]) || { limit: 0, consumption: 0 }
  res.type = type
  res.lastUpdate = limits ? limits.lastUpdate : new Date().toISOString()
  return res
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

export const setConsumption = async (db, consumer, type, value) => {
  return (await db.collection('limits')
    .findOneAndUpdate({ type: consumer.type, id: consumer.id }, { $set: { [`${type}.consumption`]: value } }, { returnDocument: 'after', upsert: true }))
}

export default {
  initLimits,
  get,
  remaining,
  incrementConsumption,
  setConsumption
}
