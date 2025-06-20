import jsonSchema from '@data-fair/lib-utils/json-schema.js'
import RunSchema from '#types/run/schema.js'

export default {
  $id: 'https://github.com/data-fair/processings/processing',
  'x-exports': [
    'types',
    'validate',
    'resolvedSchema'
  ],
  title: 'processing',
  type: 'object',
  additionalProperties: false,
  required: [
    '_id',
    'owner',
    'plugin',
    'scheduling',
    'title'
  ],
  properties: {
    _id: {
      type: 'string',
      title: 'Identifiant du traitement',
      readOnly: true
    },
    title: {
      type: 'string',
      title: 'Titre'
    },
    active: {
      title: 'Actif',
      type: 'boolean',
      default: false,
      layout: 'switch'
    },
    created: {
      type: 'object',
      additionalProperties: false,
      required: [
        'id',
        'name',
        'date'
      ],
      readOnly: true,
      properties: {
        id: {
          type: 'string',
          description: 'Id of the user that created this processing'
        },
        name: {
          type: 'string',
          description: 'Name of the user that created this processing'
        },
        date: {
          type: 'string',
          description: 'Creation date of this processing',
          format: 'date-time'
        }
      }
    },
    config: {
      // this content varies depending on used plugin
      type: 'object'
    },
    debug: {
      type: 'boolean',
      title: 'Mode debug',
      description: 'Active le mode debug pour ce traitement',
      readOnly: true
    },
    owner: {
      $ref: 'https://github.com/data-fair/lib/account',
      readOnly: true
    },
    plugin: {
      type: 'string',
      readOnly: true
    },
    scheduling: {
      type: 'array',
      title: 'Planification du traitement',
      layout: {
        messages: {
          addItem: 'Ajouter une règle de planification'
        },
        cols: 6
      },
      items: {
        $ref: 'https://github.com/data-fair/processings/scheduling'
      }
    },
    secrets: {
      type: 'object',
      readOnly: true,
      additionalProperties: {
        $ref: '#/$defs/cipheredContent'
      }
    },
    permissions: {
      type: 'array',
      title: 'Permissions',
      layout: {
        messages: {
          addItem: 'Ajouter une permission'
        },
        cols: 6
      },
      items: {
        $ref: 'https://github.com/data-fair/processings/permission'
      }
    },
    updated: {
      type: 'object',
      additionalProperties: false,
      readOnly: true,
      required: [
        'id',
        'name',
        'date'
      ],
      properties: {
        id: {
          type: 'string',
          description: 'Id of the user that last updated this processing'
        },
        name: {
          type: 'string',
          description: 'Name of the user that last updated this processing'
        },
        date: {
          type: 'string',
          description: 'Date of the last update for this processing',
          format: 'date-time'
        }
      }
    },
    userProfile: {
      type: 'string',
      readOnly: true
    },
    lastRun: jsonSchema(RunSchema)
      .removeId()
      .removeProperties(['log', 'processing', 'owner'])
      .appendTitle('Dernière exécution')
      .schema,
    nextRun: jsonSchema(RunSchema)
      .removeId()
      .removeProperties(['log', 'processing', 'owner'])
      .appendTitle('Prochaine exécution')
      .schema,
    webhookKey: {
      type: 'string',
      title: 'Clé pour exécution à distance du traitement',
      readOnly: true
    }
  },
  layout: {
    title: null,
    children: [
      [
        {
          children: [
            'title',
            'active',
            'debug'
          ],
          cols: 8,
        },
        {
          name: 'activity',
          cols: 4,
        }
      ],
      'config',
      'scheduling',
      'permissions'
    ]
  },
  $defs: {
    cipheredContent: {
      type: 'object',
      additionalProperties: false,
      required: [
        'iv',
        'alg',
        'data'
      ],
      properties: {
        iv: {
          type: 'string',
        },
        alg: {
          type: 'string',
          const: 'aes256'
        },
        data: {
          type: 'string',
        }
      }
    }
  }
}
