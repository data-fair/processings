export default {
  type: 'object',
  title: 'Propriétaire',
  additionalProperties: true,
  readOnly: true,
  required: ['type', 'id'],
  properties: {
    type: {
      type: 'string',
      enum: ['user', 'organization'],
      description: 'If the owner is a user or an organization'
    },
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
