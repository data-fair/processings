const { owner } = require('./owner.cjs')
const scheduling = require('./scheduling.cjs')
const permissions = require('./permissions.cjs')
const run = JSON.parse(JSON.stringify(require('./run.cjs')))
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
      title: 'activer le mode debug',
      description: 'Permet à un administrateur d\'obtenir des logs plus détaillés sur les prochaines exécutions du traitement.',
      readOnly: true
    },
    lastRun: { ...run, title: 'Dernière exécution' },
    nextRun: { ...run, title: 'Prochaine exécution' },
    webhookKey: {
      type: 'string',
      title: 'Clé pour exécution à distance du traitement',
      readOnly: true
    },
    permissions,
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
