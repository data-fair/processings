import config from 'config'
import moment from 'moment'
import mongo from '@data-fair/lib/node/mongo.js'

export const initLimits = async (db) => {
  await mongo.ensureIndex('limits', { id: 'text', name: 'text' }, { name: 'fulltext' })
  await mongo.ensureIndex('limits', { type: 1, id: 1 }, { name: 'limits-find-current', unique: true })
}

export const getLimits = async (db, consumer) => {
  const coll = db.collection('limits')
  const now = moment()
  let limits = await coll.findOne({ type: consumer.type, id: consumer.id })
  if (!limits) {
    limits = {
      type: consumer.type,
      id: consumer.id,
      name: consumer.name || consumer.id,
      lastUpdate: now.toISOString(),
      defaults: true
    }
    try {
      await coll.insertOne(limits)
    } catch (err) {
      if (err.code !== 11000) throw err
    }
  }
  limits.processings_seconds = limits.processings_seconds || { consumption: 0 }
  if ([undefined, null].includes(limits.processings_seconds.limit)) limits.processings_seconds.limit = config.defaultLimits.processingsSeconds
  return limits
}

export const get = async (db, consumer, type) => {
  const limits = await exports.getLimits(db, consumer)
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
  const limits = await exports.getLimits(db, consumer)
  return {
    processingsSeconds: calculateRemainingLimit(limits, 'processings_seconds')
  }
}

export const incrementConsumption = async (db, consumer, type, inc) => {
  return (await db.collection('limits')
    .findOneAndUpdate({ type: consumer.type, id: consumer.id }, { $inc: { [`${type}.consumption`]: inc } }, { returnDocument: 'after', upsert: true })).value
}

export const setConsumption = async (db, consumer, type, value) => {
  return (await db.collection('limits')
    .findOneAndUpdate({ type: consumer.type, id: consumer.id }, { $set: { [`${type}.consumption`]: value } }, { returnDocument: 'after', upsert: true })).value
}

export default {
  initLimits,
  getLimits,
  get,
  remaining,
  incrementConsumption,
  setConsumption
}
