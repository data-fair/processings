module.exports = {
  title: 'Planification du traitement',
  type: 'object',
  oneOf: [
    {
      title: 'Toutes les # secondes',
      properties: {
        unit: {
          const: 'seconds'
        },
        interval: {
          title: 'Intervalle',
          type: 'integer',
          'x-class': 'xs4',
          default: 10
        },
        offset: {
          type: 'object',
          'x-class': 'xs4',
          properties: {
            seconds: {
              title: 'Secondes de décallage',
              type: 'integer',
              'x-class': 'xs6',
              default: 0
            }
          }
        }
      }
    },
    {
      title: 'Toutes les # minutes',
      properties: {
        unit: {
          const: 'minutes'
        },
        interval: {
          title: 'Intervalle',
          type: 'integer',
          'x-class': 'xs4',
          default: 15
        },
        offset: {
          type: 'object',
          'x-class': 'xs8',
          properties: {
            minutes: {
              title: 'Minutes de décallage',
              type: 'integer',
              'x-class': 'xs6',
              default: 0
            },
            seconds: {
              title: 'Secondes de décallage',
              type: 'integer',
              'x-class': 'xs6',
              default: 0
            }
          }
        }
      }
    },
    {
      title: 'Toutes les # heures',
      properties: {
        unit: {
          const: 'hours'
        },
        interval: {
          title: 'Intervalle',
          type: 'integer',
          'x-class': 'xs4',
          default: 3
        },
        offset: {
          title: 'Décalage',
          type: 'object',
          'x-class': 'xs8',
          properties: {
            hours: {
              title: 'Heures de décallage',
              type: 'integer',
              'x-class': 'xs6',
              default: 0
            },
            minutes: {
              title: 'Minutes de décallage',
              type: 'integer',
              'x-class': 'xs6',
              default: 0
            }
          }
        }
      }
    },
    {
      title: 'Toutes les # jours',
      properties: {
        unit: {
          const: 'days'
        },
        interval: {
          title: 'Intervalle',
          type: 'integer',
          'x-class': 'xs4',
          default: 2
        },
        offset: {
          type: 'object',
          'x-class': 'xs8',
          properties: {
            days: {
              title: 'Jours de décallage',
              type: 'integer',
              'x-class': 'xs6',
              default: 0
            },
            hours: {
              title: 'Heures de décallage',
              type: 'integer',
              'x-class': 'xs6',
              default: 0
            }
          }
        }
      }
    },
    {
      title: 'Déclenchement manuel',
      properties: {
        unit: {
          const: 'trigger'
        }
      }
    }
  ]
}
