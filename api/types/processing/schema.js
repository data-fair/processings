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
      title: 'Processing ID',
      'x-i18n-title': { fr: 'Identifiant du traitement' },
      readOnly: true
    },
    title: {
      type: 'string',
      title: 'Title',
      'x-i18n-title': { fr: 'Titre' }
    },
    active: {
      title: 'Active',
      'x-i18n-title': { fr: 'Actif' },
      type: 'boolean',
      default: false,
      layout: {
        comp: 'switch',
        switch: [{
          if: '!parent.data.active',
          props: {
            'base-color': 'error'
          }
        }],
        props: {
          color: 'primary'
        }
      }
    },
    created: {
      type: 'object',
      additionalProperties: false,
      // no name once the user is deleted from the directory
      required: [
        'id',
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
      title: 'Debug mode',
      'x-i18n-title': { fr: 'Mode debug' },
      description: 'Captures detailed logs (error stacks, HTTP calls) reserved to super-admins, to diagnose a failing plugin.',
      'x-i18n-description': { fr: 'Capture des logs détaillés (stacks d\'erreurs, appels HTTP) réservés aux super-admins, pour diagnostiquer un plugin en erreur.' },
      readOnly: true
    },
    owner: {
      $ref: 'https://github.com/data-fair/lib/account',
      readOnly: true
    },
    plugin: {
      type: 'string',
      readOnly: true,
      description: 'Registry artefact id of the plugin (e.g. @data-fair-processing-hello-world-1).'
    },
    scheduling: {
      type: 'array',
      title: 'Processing scheduling',
      'x-i18n-title': { fr: 'Planification du traitement' },
      layout: {
        messages: {
          addItem: 'Add a scheduling rule',
          'x-i18n-addItem': { fr: 'Ajouter une règle de planification' }
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
          addItem: 'Add a permission',
          'x-i18n-addItem': { fr: 'Ajouter une permission' }
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
      .appendTitle(' last run')
      .schema,
    nextRun: jsonSchema(RunSchema)
      .removeId()
      .removeProperties(['log', 'processing', 'owner'])
      .appendTitle(' next run')
      .schema,
    webhookKey: {
      type: 'string',
      title: 'Remote execution key of the processing',
      'x-i18n-title': { fr: 'Clé pour exécution à distance du traitement' },
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
