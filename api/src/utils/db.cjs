// TODO add ensureIndex instructions to init logic.

const config = require('config')
const { MongoClient } = require('mongodb')

exports.ensureIndex = async (db, collection, key, options) => {
  try {
    await db.collection(collection).createIndex(key, options || {})
  } catch (err) {
    if ((err.code !== 85 && err.code !== 86) || !options.name) throw err

    // if the error is a conflict on keys or params of the index we automatically
    // delete then recreate the index
    console.log(`Drop then recreate index ${collection}/${options.name}`)
    await db.collection(collection).dropIndex(options.name)
    await db.collection(collection).createIndex(key, options)
  }
}

exports.connect = async (maxPoolSize = 5, readPreference = 'primary') => {
  let client
  // const opts = { maxPoolSize }
  const opts = { readPreference }
  const url = config.mongo.url || `mongodb://${config.mongo.host}:${config.mongo.port}/${config.mongo.db}`
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

  await exports.ensureIndex(db, 'processings', { title: 'text' }, { name: 'fulltext' })
  await exports.ensureIndex(db, 'processings', { 'owner.type': 1, 'owner.id': 1 }, { name: 'main' })

  await exports.ensureIndex(db, 'runs', { 'owner.type': 1, 'owner.id': 1, 'processing._id': 1, createdAt: -1 }, { name: 'main' })

  return { db, client }
}
