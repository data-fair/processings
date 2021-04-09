const { owner } = require('./owner')
const scheduling = require('./scheduling')

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['_id', 'owner', 'title', 'plugin', 'scheduling'],
  properties: {
    _id: {
      type: 'string',
      title: 'Identifiant du traitement',
      readOnly: true,
    },
    owner,
    title: {
      type: 'string',
      title: 'Titre',
    },
    active: {
      title: 'Actif',
      type: 'boolean',
      default: false,
    },
    plugin: {
      type: 'string',
      readOnly: true,
    },
    scheduling,
    'last-execution': {
      title: 'Dernière exécution',
      type: 'object',
      readOnly: true,
      properties: {
        date: {
          title: 'Date',
          type: 'string',
          format: 'date-time',
        },
        status: {
          title: 'Statut',
          type: 'string',
          enum: ['ok', 'ko'],
        },
      },
    },
    webhookKey: {
      type: 'string',
      title: 'Identifiant du traitement',
      readOnly: true,
    },
    created: {
      type: 'object',
      additionalProperties: false,
      required: ['date'],
      readOnly: true,
      properties: {
        id: {
          type: 'string',
          description: 'Id of the user that created this processing',
        },
        name: {
          type: 'string',
          description: 'Name of the user that created this processing',
        },
        date: {
          type: 'string',
          description: 'Creation date of this processing',
          format: 'date-time',
        },
      },
    },
    updated: {
      type: 'object',
      additionalProperties: false,
      required: ['date'],
      readOnly: true,
      properties: {
        id: {
          type: 'string',
          description: 'Id of the user that last updated this processing',
        },
        name: {
          type: 'string',
          description: 'Name of the user that last updated this processing',
        },
        date: {
          type: 'string',
          description: 'Date of the last update for this processing',
          format: 'date-time',
        },
      },
    },
  },
}
