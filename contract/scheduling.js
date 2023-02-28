module.exports = {
  title: 'Planification du traitement',
  type: 'object',
  oneOf: [
    {
      title: 'Déclenchement manuel',
      properties: {
        type: {
          const: 'trigger'
        }
      }
    },
    {
      title: 'Mensuel',
      properties: {
        type: {
          const: 'monthly'
        },
        dayOfWeek: {
          type: 'string',
          const: '*'
        },
        dayOfMonth: {
          title: 'Jour du mois',
          type: 'integer',
          minimum: 1,
          maximum: 28,
          default: 1,
          'x-cols': 6,
          'x-class': 'pr-1'
        },
        hour: {
          title: 'Heure de la journée',
          description: 'de 0 à 23',
          type: 'integer',
          minimum: 0,
          maximum: 23,
          default: 0,
          'x-cols': 6
        },
        minute: {
          title: 'Minute',
          description: 'de 0 à 59',
          type: 'integer',
          minimum: 0,
          maximum: 23,
          default: 0,
          'x-cols': 6,
          'x-class': 'pr-1'
        },
        month: {
          type: 'string',
          const: '*'
        },
        timeZone: {
          type: 'string',
          'x-cols': 6,
          'x-display': 'custom-time-zone'
        }
      }
    },
    {
      title: 'Hebdomadaire',
      properties: {
        type: {
          const: 'weekly'
        },
        dayOfWeek: {
          title: 'Jour de la semaine',
          type: 'string',
          oneOf: [{
            const: '1',
            title: 'lundi'
          }, {
            const: '2',
            title: 'mardi'
          }, {
            const: '3',
            title: 'mercredi'
          }, {
            const: '4',
            title: 'jeudi'
          }, {
            const: '5',
            title: 'vendredi'
          }, {
            const: '6',
            title: 'samedi'
          }, {
            const: '0',
            title: 'dimanche'
          }],
          default: '1',
          'x-cols': 6,
          'x-class': 'pr-1'
        },
        hour: {
          title: 'Heure de la journée',
          description: 'de 0 à 23',
          type: 'integer',
          minimum: 0,
          maximum: 23,
          default: 0,
          'x-cols': 6,
          'x-class': 'pl-1'
        },
        minute: {
          title: 'Minute',
          description: 'de 0 à 59',
          type: 'integer',
          minimum: 0,
          maximum: 23,
          default: 0,
          'x-cols': 6,
          'x-class': 'pr-1'
        },
        dayOfMonth: {
          type: 'string',
          const: '*'
        },
        month: {
          type: 'string',
          const: '*'
        },
        timeZone: {
          type: 'string',
          'x-cols': 6,
          'x-display': 'custom-time-zone'
        }
      }
    },
    {
      title: 'Journalier',
      properties: {
        type: {
          const: 'daily'
        },
        dayOfWeek: {
          type: 'string',
          const: '*'
        },
        hour: {
          title: 'Heure de la journée',
          description: 'de 0 à 23',
          type: 'integer',
          minimum: 0,
          maximum: 23,
          default: 0,
          'x-cols': 6,
          'x-class': 'pr-1'
        },
        timeZone: {
          type: 'string',
          'x-cols': 6,
          'x-display': 'custom-time-zone'
        },
        minute: {
          title: 'Minute',
          description: 'de 0 à 59',
          type: 'integer',
          minimum: 0,
          maximum: 23,
          default: 0,
          'x-cols': 6,
          'x-class': 'pr-1'
        },
        dayOfMonth: {
          type: 'string',
          const: '*'
        },
        month: {
          type: 'string',
          const: '*'
        }
      }
    },
    {
      title: 'Toutes les # heures',
      properties: {
        type: {
          const: 'hours'
        },
        dayOfWeek: {
          type: 'string',
          const: '*'
        },
        hour: {
          type: 'string',
          const: '*'
        },
        hourStep: {
          title: 'Nombre d\'heures de l\'interval',
          type: 'integer',
          minimum: 1,
          maximum: 12,
          default: 1,
          'x-cols': 6,
          'x-class': 'pl-1'
        },
        minute: {
          title: 'Minute',
          description: 'de 0 à 59',
          type: 'integer',
          minimum: 0,
          maximum: 59,
          default: 0,
          'x-cols': 6,
          'x-class': 'pl-1'
        },
        dayOfMonth: {
          type: 'string',
          const: '*'
        },
        month: {
          type: 'string',
          const: '*'
        }
      }
    }
  ]
}
