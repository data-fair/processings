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
    'permissions',
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
    permissions: {
      type: 'array',
      title: 'Permissions',
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
  }
}
