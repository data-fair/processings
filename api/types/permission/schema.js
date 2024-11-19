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
      title: 'profil',
      default: 'read',
      oneOf: [
        { const: 'read', title: "lecture - permet d'accéder aux informations essentielles du traitement dont les logs, mais pas aux informations sensibles" },
        { const: 'exec', title: "exécution - permet d'accéder aux informations essentielles du traitement et de déclencher le traitement" }
      ]
    },
    target: {
      type: 'object',
      oneOfLayout: {
        label: 'type de cible'
      },
      oneOf: [
        {
          title: 'utilisateur désigné par son email',
          required: ['email'],
          properties: {
            type: {
              const: 'userEmail'
            },
            email: {
              type: 'string',
              title: 'email'
            }
          }
        },
        {
          title: 'organisation partenaire',
          required: ['organization', 'roles'],
          properties: {
            type: {
              const: 'partner'
            },
            organization: {
              type: 'object',
              title: 'organisation',
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
              title: 'rôles',
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
