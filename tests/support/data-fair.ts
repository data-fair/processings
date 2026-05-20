import crypto from 'node:crypto'
import { MongoClient } from 'mongodb'

/**
 * Seed an admin-mode API key into data-fair's mongo settings collection so
 * the worker can call /api/v1/datasets etc. on behalf of any test owner.
 *
 * Worker dev config hardcodes the same raw key (see
 * `worker/config/development.mjs`); state-setup calls this helper once per
 * test run, idempotently. The key is sha512-hashed before storage to match
 * what data-fair's `readApiKey` middleware looks up.
 */

export const DEV_TEST_DF_API_KEY = 'dev-test-processings-worker-key'

const SETTINGS_DOC_ID = 'user:processings-worker-test'

export const seedDataFairApiKey = async (rawKey: string = DEV_TEST_DF_API_KEY) => {
  const url = `mongodb://localhost:${process.env.MONGO_PORT ?? '27017'}/data-fair`
  const client = new MongoClient(url)
  try {
    await client.connect()
    const db = client.db()
    const hashedKey = crypto.createHash('sha512').update(rawKey).digest('hex')
    await db.collection('settings').updateOne(
      { _id: SETTINGS_DOC_ID as any },
      {
        $set: {
          id: 'processings-worker-test',
          type: 'user',
          name: 'Processings worker test key',
          apiKeys: [{
            id: 'worker',
            title: 'Processings worker (dev/test)',
            key: hashedKey,
            scopes: ['datasets', 'applications', 'catalogs', 'stats'],
            adminMode: true,
            asAccount: true
          }]
        }
      },
      { upsert: true }
    )
  } finally {
    await client.close()
  }
}
