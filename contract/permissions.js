const permissions = {
  type: 'array',
  title: 'Permissions',
  layout: {
    messages: {
      addItem: 'Ajouter une permission'
    }
  },
  items: {
    type: 'object',
    required: ['profile', 'target'],
    properties: {
      profile: {
        type: 'string',
        title: 'Profil',
        default: 'read',
        oneOf: [
          { const: 'read', title: 'lecture - permet d\'accéder aux informations essentielles du traitement dont les logs, mais pas aux informations sensibles' },
          { const: 'exec', title: 'exécution - permet d\'accéder aux informations essentielles du traitement et de déclencher le traitement' }
        ]
      },
      target: {
        type: 'object',
        oneOf: [
          {
            title: 'utilisateur désigné par son email',
            required: ['email'],
            properties: {
              type: {
                const: 'userEmail',
                title: 'Type de cible',
                'x-options': { hideInArrayItem: true }
              },
              email: {
                type: 'string',
                title: 'Email'
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
                title: 'Organisation',
                'x-fromUrl': '{context.directoryUrl}/api/organizations/{context.owner.id}',
                'x-itemsProp': 'partners',
                'x-itemKey': 'id',
                'x-itemTitle': 'name',
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
                title: 'Rôles',
                default: ['admin'],
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
}

export default permissions
