/**
 * @param {import('mongodb').Db } db
 * @returns {Promise<import('mongodb').Collection>}
 */
export const channel = async (db) => {
  const collection = (await db.listCollections({ name: 'messages' }).toArray())[0]
  if (!collection) await db.createCollection('messages', { capped: true, size: 100000, max: 1000 })
  return db.collection('messages')
}

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<(channel: string, data: any) => void>}
 */
export const initPublisher = async (db) => {
  // Write to pubsub channel
  const mongoChannel = await channel(db)
  await mongoChannel.insertOne({ type: 'init' })
  return (channel, data) => {
    // console.log(channel, data)
    mongoChannel.insertOne({ type: 'message', channel, data })
  }
}
