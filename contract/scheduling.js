module.exports = {
  title: 'Planification du traitement',
  type: 'object',
  oneOf: [
    {
      title: 'Déclenchement manuel',
      properties: {
        type: {
          const: 'trigger',
        },
      },
    },
    {
      title: 'Mensuel',
      properties: {
        type: {
          const: 'monthly',
        },
        dayOfWeek: {
          type: 'string',
          const: '*',
        },
        dayOfMonth: {
          type: 'integer',
          minimum: 1,
          maximum: 28,
        },
        hour: {
          type: 'integer',
          minimum: 0,
          maximum: 23,
        },
        minute: {
          type: 'integer',
          const: 0,
        },
        month: {
          type: 'string',
          const: '*',
        },
      },
    },
    {
      title: 'Hebdomadaire',
      properties: {
        type: {
          const: 'weekly',
        },
        dayOfWeek: {
          type: 'string',
          oneOf: [{
            const: 1,
            title: 'lundi',
          }, {
            const: 2,
            title: 'mardi',
          }, {
            const: 3,
            title: 'mercredi',
          }, {
            const: 4,
            title: 'jeudi',
          }, {
            const: 5,
            title: 'vendredi',
          }, {
            const: 6,
            title: 'samedi',
          }, {
            const: 0,
            title: 'dimanche',
          }],
        },
        hour: {
          type: 'integer',
          minimum: 0,
          maximum: 23,
        },
        minute: {
          type: 'integer',
          const: 0,
        },
        dayOfMonth: {
          type: 'string',
          const: '*',
        },
        month: {
          type: 'string',
          const: '*',
        },
      },
    },
    {
      title: 'Journalier',
      properties: {
        type: {
          const: 'daily',
        },
        dayOfWeek: {
          type: 'string',
          const: '*',
        },
        hour: {
          type: 'integer',
          minimum: 0,
          maximum: 23,
        },
        minute: {
          type: 'integer',
          const: 0,
        },
        dayOfMonth: {
          type: 'string',
          const: '*',
        },
        month: {
          type: 'string',
          const: '*',
        },
      },
    },
    {
      title: 'Toutes les # heures',
      properties: {
        type: {
          const: 'hours',
        },
        dayOfWeek: {
          type: 'string',
          const: '*',
        },
        hour: {
          type: 'integer',
          const: '*',
        },
        hourStep: {
          type: 'integer',
          minimum: 1,
          maximum: 12,
        },
        minute: {
          type: 'integer',
          minimum: 0,
          maximum: 59,
        },
        dayOfMonth: {
          type: 'string',
          const: '*',
        },
        month: {
          type: 'string',
          const: '*',
        },
      },
    },
  ],
}
