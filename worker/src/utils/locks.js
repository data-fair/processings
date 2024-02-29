import { nanoid } from 'nanoid'
import config from '../config.js'

const pid = nanoid()

let interval
export const init = async db => {
  const locks = db.collection('locks')
  await locks.createIndex({ pid: 1 })
  try {
    await locks.createIndex({ updatedAt: 1 }, { expireAfterSeconds: config.locks.ttl })
  } catch (err) {
    console.log('Failure to create TTL index. Probably because the value changed. Try to update it.')
    db.command({ collMod: 'locks', index: { keyPattern: { updatedAt: 1 }, expireAfterSeconds: config.locks.ttl } })
  }

  // prolongate lock acquired by this process while it is still active
  interval = setInterval(() => {
    locks.updateMany({ pid }, { $currentDate: { updatedAt: true } })
  }, (config.locks.ttl / 2) * 1000)
}

export const stop = () => {
  clearInterval(interval)
}

export const acquire = async (db, _id) => {
  const locks = db.collection('locks')
  try {
    await locks.insertOne({ _id, pid })
    try {
      await locks.updateOne({ _id, pid }, { $currentDate: { updatedAt: true } })
    } catch (err) {
      await locks.deleteOne({ _id, pid })
      throw err
    }
    // double check in case of a weird race condition on the insertOne unique check
    if (!await locks.findOne({ _id, pid })) return false
    return true
  } catch (err) {
    if (err.code !== 11000) throw err
    // duplicate means the lock was already acquired
    return false
  }
}

export const release = async (db, _id) => {
  const locks = db.collection('locks')
  await locks.deleteOne({ _id, pid })
}

export default { init, stop, acquire, release }
