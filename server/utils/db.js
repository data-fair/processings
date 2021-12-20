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

exports.connect = async (maxPoolSize = 5, readPreference = 'primary') => {
  let client
  // const opts = { maxPoolSize }
  const opts = {}
  const url = `mongodb://${config.mongo.host}:${config.mongo.port}/${config.mongo.db}?readPreference=${readPreference}`
  try {
    client = await MongoClient.connect(url, opts)
  } catch (err) {
    // 1 retry after 1s
    // solve the quite common case in docker-compose of the service starting at the same time as the db
    await new Promise(resolve => setTimeout(resolve, 1000))
    client = await MongoClient.connect(url, opts)
  }
  const db = client.db()
  return { db, client }
}

exports.init = async (poolSize, readPreference) => {
  console.log('Connecting to mongodb ' + `${config.mongo.host}:${config.mongo.port}`)
  const { db, client } = await exports.connect(poolSize, readPreference)

  await ensureIndex(db, 'processings', { title: 'text' }, { name: 'fulltext' })
  await ensureIndex(db, 'processings', { 'owner.type': 1, 'owner.id': 1 }, { name: 'main' })

  await ensureIndex(db, 'runs', { 'owner.type': 1, 'owner.id': 1, 'processing._id': 1 }, { name: 'main' })

  return { db, client }
}
