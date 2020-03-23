const config = require('config')
const path = require('path')
const fs = require('fs')
const owner = require('./owner')

const sources = fs.readdirSync(path.join(__dirname, '../sources'))
  .map(s => require('../sources/' + s + '/meta.json'))

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'source', 'dataset'],
  properties: {
    id: {
      type: 'string',
      title: 'Identifiant du traitement',
      readOnly: true
    },
    title: {
      type: 'string',
      title: 'Titre'
    },
    source: {
      title: 'Source des données',
      type: 'object',
      oneOf: sources
    },
    active: {
      title: 'Actif',
      type: 'boolean',
      default: false
    },
    periodicity: {
      title: 'Périodicité de la récupération',
      type: 'object',
      properties: {
        value: {
          title: 'Valeur',
          type: 'integer',
          'x-class': 'xs6',
          default: 10
        },
        unit: {
          title: 'Unité',
          type: 'string',
          enum: ['secondes', 'minutes', 'heures'],
          'x-class': 'xs6',
          default: 'minutes'
        }
      }
    },
    dataset: {
      title: 'Jeu de données Data Fair',
      type: 'object',
      'x-itemKey': 'id',
      'x-itemTitle': 'title',
      properties: {
        id: {
          title: 'Identifiant du dataset',
          type: 'string'
        },
        title: {
          title: 'Titre du dataset',
          type: 'string'
        }
      }
    },
    status: {
      title: 'Statut',
      type: 'string',
      enum: ['running', 'stopped'],
      default: 'stopped',
      'x-display': 'hidden'
    },
    'last-execution': {
      title: 'Dernière exécution',
      type: 'object',
      readOnly: true,
      properties: {
        date: {
          title: 'Date',
          type: 'string',
          format: 'date-time'
        },
        status: {
          title: 'Statut',
          type: 'string',
          enum: ['ok', 'ko']
        }
      }
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

if (config.dataFairAdminMode) {
  module.exports.required.push('owner')
  module.exports.properties.owner = owner
}
