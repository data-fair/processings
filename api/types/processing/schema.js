import jsonSchema from '@data-fair/lib-utils/json-schema.js'
import RunSchema from '#types/run/schema.js'

export default {
  $id: 'https://github.com/data-fair/processings/processing',
  'x-exports': [
    'types',
    'validate',
    'schema'
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
    active: {
      title: 'Actif',
      type: 'boolean',
      default: false,
      'x-display': 'switch'
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
      title: 'activer le mode debug',
      readOnly: true
    },
    owner: {
      $ref: 'https://github.com/data-fair/lib/account'
    },
    permissions: {
      type: 'array',
      items: {
        $ref: 'https://github.com/data-fair/processings/permission'
      }
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
        }
      },
      items: {
        $ref: 'https://github.com/data-fair/processings/scheduling'
      }
    },
    title: {
      type: 'string',
      title: 'Titre'
    },
    updated: {
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
      type: 'string'
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
  }
}
