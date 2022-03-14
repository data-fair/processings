
const assert = require('assert').strict

describe('Plugins', () => {
  it('should install a new plugin then list and remove it', async () => {
    const plugin = {
      name: '@koumoul/data-fair-processings-hello-world',
      version: '0.3.0',
      distTag: 'latest',
      description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.',
      npm: 'https://www.npmjs.com/package/%40koumoul%2Fdata-fair-processings-hello-world'
    }
    let res = await global.ax.superadmin.post('/api/v1/plugins', plugin)
    assert.equal(res.data.name, '@koumoul/data-fair-processings-hello-world')

    res = await global.ax.superadmin.get('/api/v1/plugins')
    assert.equal(res.data.count, 1)
    assert.equal(res.data.results.length, 1)
    assert.equal(res.data.results[0].name, '@koumoul/data-fair-processings-hello-world')
  })
})
