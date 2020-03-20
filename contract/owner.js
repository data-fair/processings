const config = require('config')

module.exports = {
  type: 'object',
  title: 'Propriétaire',
  additionalProperties: false,
  required: ['id'],
  'x-fromUrl': config.directoryUrl + '/api/organizations',
  'x-itemsProp': 'results',
  'x-itemTitle': 'name',
  'x-itemKey': 'id',
  properties: {
    id: {
      type: 'string',
      description: 'The unique id of the organization'
    },
    name: {
      type: 'string',
      description: 'The display name of the organization'
    }
  }
}
