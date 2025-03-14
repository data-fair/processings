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
    'description',
    'version',
    'distTag',
    'id',
    'metadata',
    'pluginConfigSchema',
    'pluginMetadataSchema',
    'processingConfigSchema'
  ],
  properties: {
    name: {
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
    pluginMetadataSchema: {
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
    },
    metadata: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'category', 'icon'],
      properties: {
        name: {
          type: 'string'
        },
        description: {
          type: 'string'
        },
        category: {
          type: 'string'
        },
        icon: {
          type: 'string'
        }
      }
    }
  }
}
