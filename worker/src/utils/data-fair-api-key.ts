import config from '#config'
import mongo from '#mongo'

/**
 * The environment of a task's child process. Its data-fair requests carry the API key of the configuration
 * (DATA_FAIR_API_KEY), an admin mode key acting as the processing's owner (x-account). Without a configured key, in
 * development, the child gets the key the test setup handed over: it creates the key through data-fair's API
 * (tests/support/data-fair.ts) and stores it in this database through the test API
 * (PUT /api/v1/test-env/data-fair-api-key), read again before each run.
 */
export const taskEnv = async (): Promise<NodeJS.ProcessEnv> => {
  if (config.dataFairAPIKey || process.env.NODE_ENV !== 'development') return process.env
  const doc = await mongo.db.collection<{ _id: string, key: string }>('test-env').findOne({ _id: 'data-fair-api-key' })
  return doc?.key ? { ...process.env, DATA_FAIR_API_KEY: doc.key } : process.env
}
