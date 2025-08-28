export default {
  $id: 'https://github.com/data-fair/processings/plugin',
  'x-exports': [
    'types',
    'validate',
    'resolvedSchema'
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
      type: 'string',
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
      type: 'object',
      description: 'Schema de configuration du plugin.',
    },
    pluginMetadataSchema: {
      type: 'object',
      description: 'Schema de configuration des metadata.'
    },
    processingConfigSchema: {
      type: 'object',
      description: 'Schema de configuration du traitement.'
    },
    config: {
      type: 'object',
      description: 'La configuration du plugin respectant le schema de configuration du plugin.',
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
      description: 'Les metadata du plugin respectant le schema de configuration des metadata.',
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
        },
        documentation: {
          type: 'string'
        }
      }
    }
  }
}
