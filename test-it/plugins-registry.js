import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { axiosBuilder } from '@data-fair/lib/node/axios.js'

const axiosOpts = { baseURL: 'http://localhost:5600' }
const anonymous = axiosBuilder(axiosOpts)

await test('should search for plugins on npmjs', async function () {
  const res = await anonymous.get('/api/v1/plugins-registry', { params: { q: '@data-fair hello world' } })
  assert.equal(res.data.count, 2)
  assert.equal(res.data.results.length, 2)
  assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')
  assert.equal(res.data.results[0].distTag, 'latest')
  assert.equal(res.data.results[1].name, '@data-fair/processing-hello-world')
  assert.equal(res.data.results[1].distTag, 'test')
})
