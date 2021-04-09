
const assert = require('assert').strict

describe.only('Processings', () => {
  let plugin
  before('prepare a plugin', async () => {
    plugin = (await global.ax.superadmin.post('/api/v1/plugins', {
      name: '@koumoul/data-fair-processings-hello-world',
      version: '0.1.0',
      description: 'Minimal plugin for data-fair-processings. Create one-line datasets on demand.',
      npm: 'https://www.npmjs.com/package/%40koumoul%2Fdata-fair-processings-hello-world',
    })).data
  })

  it('should create a new processing', async () => {
    const processing = (await global.ax.superadmin.post('/api/v1/processings', {
      title: 'Hello processing',
      plugin: plugin.id,
    })).data
    assert.ok(processing._id)
    const runs = (await global.ax.superadmin.get('/api/v1/runs', { params: { processing: processing._id } })).data
    assert.equal(runs.count, 0)
  })
})
