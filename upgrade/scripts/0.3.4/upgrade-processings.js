const cryptoRandomString = require('crypto-random-string')

exports.description = 'Processings must have a webhookKey'

exports.exec = async (db, debug) => {
  const cursor = db.collection('processings').find({ webhookKey: { $exists: false } })
  while (await cursor.hasNext()) {
    const processing = await cursor.next()
    debug('Upgrade processing', processing.id)
    const update = {
      $set: {
        webhookKey: cryptoRandomString({ length: 16, type: 'url-safe' })
      }
    }
    await db.collection('processings').updateOne({ id: processing.id }, update)
  }
}
