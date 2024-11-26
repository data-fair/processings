import { strict as assert } from 'node:assert'
import { it, describe, before, after } from 'node:test'
import { axios, startApiServer, stopApiServer } from './utils/index.ts'

const axAno = axios()

describe('plugin-registry', () => {
  before(startApiServer)
  after(stopApiServer)

  it('should search for plugins (just lastest) on npmjs', async () => {
    const res = await axAno.get('/api/v1/plugins-registry', { params: { q: '@data-fair hello world' } })
    assert.equal(res.data.count, 1)
    assert.equal(res.data.results.length, 1)
    assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')
    assert.equal(res.data.results[0].distTag, 'latest')
  })

  it('should search for plugins and all their distTag versions on npmjs', async () => {
    const res = await axAno.get('/api/v1/plugins-registry', { params: { q: '@data-fair hello world', showAll: 'true' } })
    assert.equal(res.data.count, 2)
    assert.equal(res.data.results.length, 2)
    assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')
    assert(['latest', 'test'].includes(res.data.results[0].distTag))
    assert.equal(res.data.results[1].name, '@data-fair/processing-hello-world')
    assert(['test', 'latest'].includes(res.data.results[1].distTag))
  })
})
