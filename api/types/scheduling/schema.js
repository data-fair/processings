export default {
  $id: 'https://github.com/data-fair/processings/scheduling',
  'x-exports': [
    'types'
  ],
  title: 'scheduling',
  type: 'object',
  oneOfLayout: {
    emptyData: true
  },
  oneOf: [
    {
      title: 'Mensuel',
      properties: {
        type: { const: 'monthly' },
        dayOfWeek: { type: 'string', const: '*' },
        dayOfMonth: { type: 'integer', minimum: 1, maximum: 28, default: 1, 'x-cols': 6, 'x-class': 'pr-1' },
        hour: { type: 'integer', minimum: 0, maximum: 23, default: 0, 'x-cols': 6 },
        minute: { type: 'integer', minimum: 0, maximum: 59, default: 0, 'x-cols': 6, 'x-class': 'pr-1' },
        month: { type: 'string', const: '*' },
        timeZone: {
          type: 'string',
          title: 'Fuseau horaire',
          default: 'Europe/Paris',
          layout: { comp: 'autocomplete', cols: 6, getItems: 'context.utcs' }
        }
      }
    },
    {
      title: 'Hebdomadaire',
      properties: {
        type: { const: 'weekly' },
        dayOfWeek: {
          type: 'string',
          oneOf: [
            { const: '1', title: 'lundi' },
            { const: '2', title: 'mardi' },
            { const: '3', title: 'mercredi' },
            { const: '4', title: 'jeudi' },
            { const: '5', title: 'vendredi' },
            { const: '6', title: 'samedi' },
            { const: '0', title: 'dimanche' }
          ],
          default: '1',
          'x-cols': 6,
          'x-class': 'pr-1'
        },
        hour: { type: 'integer', minimum: 0, maximum: 23, default: 0, 'x-cols': 6, 'x-class': 'pl-1' },
        minute: { type: 'integer', minimum: 0, maximum: 59, default: 0, 'x-cols': 6, 'x-class': 'pr-1' },
        dayOfMonth: { type: 'string', const: '*' },
        month: { type: 'string', const: '*' },
        timeZone: {
          type: 'string',
          title: 'Fuseau horaire',
          default: 'Europe/Paris',
          layout: { comp: 'autocomplete', cols: 6, getItems: 'context.utcs' }
        }
      }
    },
    {
      title: 'Journalier',
      properties: {
        type: { const: 'daily' },
        dayOfWeek: { type: 'string', const: '*' },
        hour: { type: 'integer', minimum: 0, maximum: 23, default: 0, 'x-cols': 6, 'x-class': 'pr-1' },
        minute: { type: 'integer', minimum: 0, maximum: 59, default: 0, 'x-cols': 6, 'x-class': 'pr-1' },
        dayOfMonth: { type: 'string', const: '*' },
        month: { type: 'string', const: '*' },
        timeZone: {
          type: 'string',
          title: 'Fuseau horaire',
          default: 'Europe/Paris',
          layout: { comp: 'autocomplete', cols: 6, getItems: 'context.utcs' }
        }
      }
    },
    {
      title: 'Toutes les # heures',
      properties: {
        type: { const: 'hours' },
        dayOfWeek: { type: 'string', const: '*' },
        hour: { type: 'string', const: '*' },
        hourStep: { type: 'integer', minimum: 1, maximum: 12, default: 1, 'x-cols': 6, 'x-class': 'pl-1' },
        minute: { type: 'integer', minimum: 0, maximum: 59, default: 0, 'x-cols': 6, 'x-class': 'pl-1' },
        dayOfMonth: { type: 'string', const: '*' },
        month: { type: 'string', const: '*' }
      }
    }
  ]
}
