export default {
  $id: 'https://github.com/data-fair/processings/scheduling',
  'x-exports': ['types'],
  title: 'Scheduling',
  type: 'object',
  required: ['type', 'month', 'dayOfWeek', 'dayOfMonth', 'hour', 'minute'],
  // Empty data when we select another oneOf option
  oneOfLayout: {
    emptyData: true,
  },
  oneOf: [
    {
      title: 'Monthly',
      'x-i18n-title': {
        fr: 'Mensuel'
      },
      properties: {
        type: { const: 'monthly' },
        month: { const: '*' },
        dayOfWeek: { const: '*' },
        dayOfMonth: {
          title: 'Day of the Month',
          'x-i18n-title': {
            fr: 'Jour fixe dans le mois'
          },
          type: 'integer',
          minimum: 1,
          maximum: 28,
          default: 1,
          layout: {
            cols: { xs: 6 },
            switch: [
              {
                if: 'parent.data?.lastDayOfMonth',
                props: {
                  disabled: true
                }
              }
            ]
          }
        },
        lastDayOfMonth: {
          title: 'Last Day of the Month',
          'x-i18n-title': {
            fr: 'Dernier jour du mois'
          },
          type: 'boolean',
          default: false,
          layout: { cols: { xs: 6 } }
        },
        hour: {
          $ref: '#/$defs/hour'
        },
        minute: {
          $ref: '#/$defs/minute'
        },
        timeZone: {
          $ref: '#/$defs/timeZone'
        }
      }
    },
    {
      title: 'Weekly',
      'x-i18n-title': {
        fr: 'Hebdomadaire'
      },
      properties: {
        type: { const: 'weekly' },
        month: { const: '*' },
        dayOfMonth: { const: '*' },
        dayOfWeek: {
          title: 'Day of the Week',
          'x-i18n-title': {
            fr: 'Jour fixe dans la semaine'
          },
          type: 'string',
          oneOf: [
            {
              const: '1',
              title: 'Monday',
              'x-i18n-title': {
                fr: 'Lundi'
              }
            },
            {
              const: '2',
              title: 'Tuesday',
              'x-i18n-title': {
                fr: 'Mardi'
              }
            },
            {
              const: '3',
              title: 'Wednesday',
              'x-i18n-title': {
                fr: 'Mercredi'
              }
            },
            {
              const: '4',
              title: 'Thursday',
              'x-i18n-title': {
                fr: 'Jeudi'
              }
            },
            {
              const: '5',
              title: 'Friday',
              'x-i18n-title': {
                fr: 'Vendredi'
              }
            },
            {
              const: '6',
              title: 'Saturday',
              'x-i18n-title': {
                fr: 'Samedi'
              }
            },
            {
              const: '0',
              title: 'Sunday',
              'x-i18n-title': {
                fr: 'Dimanche'
              }
            }
          ],
          default: '1'
        },
        hour: { $ref: '#/$defs/hour' },
        minute: { $ref: '#/$defs/minute' },
        timeZone: { $ref: '#/$defs/timeZone' }
      }
    },
    {
      title: 'Daily',
      'x-i18n-title': {
        fr: 'Journalier'
      },
      properties: {
        type: { const: 'daily' },
        month: { const: '*' },
        dayOfMonth: { const: '*' },
        dayOfWeek: { const: '*' },
        hour: { $ref: '#/$defs/hour' },
        minute: { $ref: '#/$defs/minute' },
        timeZone: { $ref: '#/$defs/timeZone' }
      }
    },
    {
      title: 'Each # Hours',
      'x-i18n-title': {
        fr: 'Toutes les # heures'
      },
      properties: {
        type: { const: 'hourly' },
        month: { const: '*' },
        dayOfMonth: { const: '*' },
        dayOfWeek: { const: '*' },
        hour: { const: '*' },
        hourStep: {
          title: 'Interval in Hours',
          'x-i18n-title': {
            fr: 'Interval en heures'
          },
          type: 'integer',
          minimum: 1,
          maximum: 12,
          default: 1,
          layout: { cols: { xs: 6 } }
        },
        minute: { $ref: '#/$defs/minute' },
        timeZone: { $ref: '#/$defs/timeZone' },
      }
    }
  ],
  layout: {
    switch: [
      {
        if: 'summary',
        slots: {
          component: 'scheduling-summary'
        }
      }
    ]
  },
  $defs: {
    hour: {
      title: 'Hour',
      'x-i18n-title': {
        fr: 'Heure fixe dans le jour'
      },
      type: 'integer',
      minimum: 0,
      maximum: 23,
      default: 0,
      layout: { cols: { xs: 6 } }
    },
    minute: {
      title: 'Minute',
      'x-i18n-title': {
        fr: 'Minute fixe dans l\'heure'
      },
      type: 'integer',
      minimum: 0,
      maximum: 59,
      default: 0,
      layout: { cols: { xs: 6 } }
    },
    timeZone: {
      type: 'string',
      title: 'Time Zone',
      'x-i18n-title': {
        fr: 'Fuseau horaire'
      },
      default: 'Europe/Paris',
      layout: { comp: 'autocomplete', getItems: 'context.utcs' }
    }
  }
}
