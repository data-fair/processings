const { owner } = require('./owner')
const scheduling = require('./scheduling')
const run = JSON.parse(JSON.stringify(require('./run')))
delete run.required
delete run.properties.log
delete run.properties.processing
delete run.properties.owner
run.readOnly = true

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['_id', 'owner', 'title', 'plugin', 'scheduling'],
  properties: {
    _id: {
      type: 'string',
      title: 'Identifiant du traitement',
      readOnly: true
    },
    owner,
    title: {
      type: 'string',
      title: 'Titre'
    },
    active: {
      title: 'Actif',
      type: 'boolean',
      default: false,
      'x-display': 'switch'
    },
    plugin: {
      type: 'string',
      readOnly: true
    },
    config: {
      // this content varies depending on used plugin
      type: 'object'
    },
    scheduling,
    debug: {
      type: 'boolean',
      readOnly: true
    },
    lastRun: { ...run, title: 'Dernière exécution' },
    nextRun: { ...run, title: 'Prochaine exécution' },
    webhookKey: {
      type: 'string',
      title: 'Identifiant du traitement',
      readOnly: true
    },
    created: {
      type: 'object',
      additionalProperties: false,
      required: ['date'],
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
    updated: {
      type: 'object',
      additionalProperties: false,
      required: ['date'],
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
    }
  }
}
