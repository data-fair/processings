const assert = require('assert').strict

describe('Plugins registry', () => {
  it('should search for plugins on npmjs', async () => {
    const res = await global.ax.anonymous.get('/api/v1/plugins-registry', { params: { q: 'hello world' } })
    assert.equal(res.data.count, 2)
    assert.equal(res.data.results.length, 2)
    assert.equal(res.data.results[0].name, '@koumoul/data-fair-processings-hello-world')
    assert.equal(res.data.results[0].distTag, 'latest')
    assert.equal(res.data.results[1].name, '@koumoul/data-fair-processings-hello-world')
    assert.equal(res.data.results[1].distTag, 'test')
  })
})
