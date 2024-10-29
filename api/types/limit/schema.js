export default {
  $id: 'https://github.com/data-fair/processings/limit',
  'x-exports': [
    'types',
    'validate'
  ],
  title: 'limit',
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'type',
    'lastUpdate'
  ],
  properties: {
    type: {
      type: 'string'
    },
    id: {
      type: 'string'
    },
    name: {
      type: 'string'
    },
    lastUpdate: {
      type: 'string',
      format: 'date-time'
    },
    defaults: {
      type: 'boolean',
      title: 'these limits were defined using default values only, not specifically defined'
    },
    processings_seconds: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: {
          type: 'number'
        },
        consumption: {
          type: 'number'
        }
      }
    }
  }
}
