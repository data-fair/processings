// TODO add ensureIndex instructions to init logic.

const config = require('config')
const { MongoClient } = require('mongodb')

async function ensureIndex(db, collection, key, options) {
  try {
    await db.collection(collection).createIndex(key, options || {})
  } catch (error) {
    console.error('Init mongodb index creation failure for', collection, key, error)
  }
}

exports.connect = async () => {
  let client
  try {
    client = await MongoClient.connect(`mongodb://${config.mongo.host}:${config.mongo.port}/${config.mongo.db}`, { useNewUrlParser: true })
  } catch (err) {
    // 1 retry after 1s
    // solve the quite common case in docker-compose of the service starting at the same time as the db
    await new Promise(resolve => setTimeout(resolve, 1000))
    client = await MongoClient.connect(`mongodb://${config.mongo.host}:${config.mongo.port}/${config.mongo.db}`, { useNewUrlParser: true })
  }
  const db = client.db()
  return { db, client }
}

exports.init = async () => {
  console.log('Connecting to mongodb ' + `${config.mongo.host}:${config.mongo.port}`)
  const { db, client } = await exports.connect()
  // processings indexes
  await ensureIndex(db, 'processings', { id: 1 }, { unique: true })
  await ensureIndex(db, 'processings', { title: 'text' }, { name: 'fulltext' })
  return { db, client }
}
