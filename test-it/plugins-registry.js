import { test } from 'node:test'
import childProcess from 'node:child_process'
import { strict as assert } from 'node:assert'
import { axiosBuilder } from '@data-fair/lib/node/axios.js'

process.env.SUPPRESS_NO_CONFIG_WARNING = '1'
childProcess.execSync('docker compose restart -t 0 nginx')

process.env.NODE_CONFIG_DIR = 'api/config/'
const apiServer = await import('../api/src/server.js')
await apiServer.start()

const axios = await axiosBuilder({ baseURL: 'http://localhost:5600' })

try {
  await test('should search for plugins on npmjs', async function () {
    const res = await axios.get('/api/v1/plugins-registry', { params: { q: '@data-fair hello world' } })
    assert.equal(res.data.count, 2)
    assert.equal(res.data.results.length, 2)
    assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')
    assert.equal(res.data.results[0].distTag, 'latest')
    assert.equal(res.data.results[1].name, '@data-fair/processing-hello-world')
    assert.equal(res.data.results[1].distTag, 'test')
  })
} finally {
  await apiServer.stop()
  process.exit(0)
}
