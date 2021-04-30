const assert = require('assert').strict

describe('Plugins registry', () => {
  it('should search for plugins on npmjs', async () => {
    const res = await global.ax.anonymous.get('/api/v1/plugins-registry', { params: { q: 'hello world' } })
    assert.equal(res.data.count, 1)
    assert.equal(res.data.results.length, 1)
    assert.equal(res.data.results[0].name, '@koumoul/data-fair-processings-hello-world')
  })
})
