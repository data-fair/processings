const assert = require('assert').strict

describe('Plugins registry', () => {
  it('should search for plugins on npmjs', async () => {
    const res = await global.ax.anonymous.get('/api/v1/plugins-registry', { params: { q: '@data-fair hello world' } })
    assert.equal(res.data.count, 2)
    assert.equal(res.data.results.length, 2)
    assert.equal(res.data.results[0].name, '@data-fair/processing-hello-world')
    assert.equal(res.data.results[0].distTag, 'latest')
    assert.equal(res.data.results[1].name, '@data-fair/processing-hello-world')
    assert.equal(res.data.results[1].distTag, 'test')
  })
})
