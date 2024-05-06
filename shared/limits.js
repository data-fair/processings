/**
 * @param {import('mongodb').Db} db
 * @param {any} consumer
 * @param {number} processingsSeconds
 */
export const getLimits = async (db, consumer, processingsSeconds = -1) => {
  const coll = db.collection('limits')
  const now = new Date()
  /** @type {any} */
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
    } catch (/** @type {any} */ err) {
      if (err.code !== 11000) throw err
    }
  }
  limits.processings_seconds = limits.processings_seconds || { consumption: 0 }
  if ([undefined, null].includes(limits.processings_seconds.limit)) limits.processings_seconds.limit = processingsSeconds
  return limits
}
