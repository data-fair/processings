import { strict as assert } from 'node:assert'
import { it, describe, before, after } from 'node:test'
import { axios, startApiServer, stopApiServer } from './utils/index.ts'

const axAno = axios()

describe('plugin-registry', () => {
  before(startApiServer)
  after(stopApiServer)

  it('should search for plugins (just lastest) on npmjs', async () => {
    const res = await axAno.get('/api/v1/plugins-registry', { params: { q: 'hello-world' } })
    const hwProcessingPackages = res.data.results.filter(p => p.name === '@data-fair/processing-hello-world')
    assert.equal(hwProcessingPackages.length, 1)
    assert.equal(res.data.results[0].distTag, 'latest')
  })

  it('should search for plugins and all their distTag versions on npmjs', async () => {
    const res = await axAno.get('/api/v1/plugins-registry', { params: { q: 'hello-world', showAll: 'true' } })
    const hwProcessingPackages = res.data.results.filter(p => p.name === '@data-fair/processing-hello-world')
    assert.equal(hwProcessingPackages.length, 2)
    assert(['latest', 'test'].includes(res.data.results[0].distTag))
    assert(['test', 'latest'].includes(res.data.results[1].distTag))
  })
})
