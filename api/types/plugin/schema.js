export default {
  $id: 'https://github.com/data-fair/processings/plugin',
  'x-exports': [
    'types',
    'validate'
  ],
  title: 'plugin',
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'customName',
    'description',
    'version',
    'distTag',
    'id',
    'pluginConfigSchema',
    'processingConfigSchema'
  ],
  properties: {
    name: {
      type: 'string'
    },
    customName: {
      type: 'string'
    },
    description: {
      type: 'string'
    },
    version: {
      type: 'string'
    },
    distTag: {
      type: 'string'
    },
    id: {
      type: 'string'
    },
    pluginConfigSchema: {
      type: 'object'
    },
    processingConfigSchema: {
      type: 'object'
    },
    config: {
      type: 'object'
    },
    access: {
      type: 'object',
      additionalProperties: false,
      properties: {
        public: {
          type: 'boolean'
        },
        privateAccess: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'id'],
            properties: {
              type: {
                type: 'string'
              },
              id: {
                type: 'string'
              }
            }
          }
        }
      }
    }
  }
}
