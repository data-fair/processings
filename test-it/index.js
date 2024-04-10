import { run } from '@data-fair/lib/node/test-runner.js'
import fs from 'fs-extra'
import mongo from '@data-fair/lib/node/mongo.js'

const cleanDB = async () => {
  await mongo.db.collection('processings').deleteMany({})
  await mongo.db.collection('runs').deleteMany({})
  await mongo.db.collection('limits').deleteMany({})
}

// Before tests
process.env.SUPPRESS_NO_CONFIG_WARNING = '1'
process.env.NODE_CONFIG_DIR = 'api/config/'
console.log('Starting API server...')
const apiServer = await import('../api/src/server.js')
await apiServer.start()
await cleanDB()

// Run tests
await run('test-it')

// After tests
await cleanDB()
await apiServer.stop()
await fs.emptyDir('./data/test/plugins')
await fs.emptyDir('./data/test/processings')
await fs.emptyDir('./data/test/tmp')
process.exit(0)
