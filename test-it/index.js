import { run } from '@data-fair/lib/node/test-runner.js'
import fs from 'fs-extra'

// Before tests
process.env.SUPPRESS_NO_CONFIG_WARNING = '1'
process.env.NODE_CONFIG_DIR_API = 'api/config/'
console.log('Starting API server...')
const apiServer = await import('../api/src/server.js')
await apiServer.start()
await apiServer.cleanDB()

// Run tests
await run('test-it')

// After tests
await fs.emptyDir('./data/test/plugins')
await fs.emptyDir('./data/test/processings')
await fs.emptyDir('./data/test/tmp')
await apiServer.cleanDB()
await apiServer.stop()
