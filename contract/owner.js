const config = require('config')

exports.owner = {
  type: 'object',
  title: 'Propriétaire',
  additionalProperties: false,
  readOnly: true,
  required: ['type', 'id'],
  properties: {
    type: {
      type: 'string',
      enum: ['user', 'organization'],
      description: 'If the owner is a user or an organization',
    },
    id: {
      type: 'string',
      description: 'The unique id of the organization',
    },
    name: {
      type: 'string',
      description: 'The display name of the organization',
    },
  },
}

exports.editableOwner = {
  ...exports.owner,
  readOnly: false,
  'x-fromUrl': config.directoryUrl + '/api/organizations?size=1000',
  'x-itemsProp': 'results',
  'x-itemTitle': 'name',
  'x-itemKey': 'id',
}
