export default {
  $id: 'https://github.com/data-fair/processings/permission',
  'x-exports': [
    'types',
    'validate'
  ],
  title: 'permission',
  type: 'object',
  additionalProperties: false,
  required: [
    'profile',
    'target'
  ],
  properties: {
    profile: {
      type: 'string',
      title: 'Profile',
      'x-i18n-title': { fr: 'Profil' },
      default: 'read',
      oneOf: [
        {
          const: 'read',
          title: 'Read profile',
          'x-i18n-title': {
            en: 'Read - gives access to the essential information of the processing, logs included, but not to the sensitive information',
            fr: "Lecture - permet d'accéder aux informations essentielles du traitement dont les logs, mais pas aux informations sensibles"
          }
        },
        {
          const: 'exec',
          title: 'Exec profile',
          'x-i18n-title': {
            en: 'Execution - gives access to the essential information of the processing and allows to trigger it',
            fr: "Exécution - permet d'accéder aux informations essentielles du traitement et de déclencher le traitement"
          }
        }
      ]
    },
    target: {
      type: 'object',
      oneOfLayout: {
        label: 'Target type',
        'x-i18n-label': { fr: 'Type de cible' }
      },
      oneOf: [
        {
          title: 'User email',
          'x-i18n-title': { en: 'User designated by their email', fr: 'Utilisateur désigné par son email' },
          required: ['email'],
          properties: {
            type: {
              const: 'userEmail'
            },
            email: {
              type: 'string',
              title: 'Email',
              'x-i18n-title': { fr: 'Email' }
            }
          }
        },
        {
          title: 'Partner organization',
          'x-i18n-title': { fr: 'Organisation partenaire' },
          required: ['organization', 'roles'],
          properties: {
            type: {
              const: 'partner'
            },
            organization: {
              type: 'object',
              title: 'Organization',
              'x-i18n-title': { fr: 'Organisation' },
              additionalProperties: true,
              layout: {
                cols: 8,
                getItems: {
                  // eslint-disable-next-line no-template-curly-in-string
                  url: '${context.directoryUrl}/api/organizations/${context.owner.id}',
                  itemsResults: 'data.partners',
                  itemKey: 'data.id',
                  itemTitle: 'data.name'
                }
              },
              properties: {
                id: {
                  type: 'string'
                },
                name: {
                  type: 'string'
                }
              }
            },
            roles: {
              type: 'array',
              title: 'Roles',
              'x-i18n-title': { fr: 'Rôles' },
              default: ['admin'],
              layout: { cols: 4 },
              items: {
                type: 'string',
                enum: ['admin', 'contrib', 'user']
              }
            }
          }
        }
      ]
    }
  }
}
