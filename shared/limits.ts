import type { Limit } from '#api/types'
import type { ProcessingsMongo } from '../api/src/mongo.ts'

export const getLimits = async (mongo: ProcessingsMongo, consumer: Record<string, string>, processingsSeconds:number = -1) => {
  const now = new Date()
  let limits = await mongo.limits.findOne({ type: consumer.type, id: consumer.id }) as Limit
  if (!limits) {
    limits = {
      type: consumer.type,
      id: consumer.id,
      name: consumer.name || consumer.id,
      lastUpdate: now.toISOString(),
      defaults: true
    }
    try {
      await mongo.limits.insertOne(limits)
    } catch (err: any) {
      if (err.code !== 11000) throw err
    }
  }
  limits.processings_seconds = limits.processings_seconds || { consumption: 0 }
  if (limits.processings_seconds.limit === undefined || limits.processings_seconds.limit === null) limits.processings_seconds.limit = processingsSeconds
  return limits
}
