import jsonSchema from '@data-fair/lib-utils/json-schema.js'
import { type Processing, resolvedSchema as ProcessingSchema } from '#types/processing/index.ts'
import { readFileSync } from 'node:fs'
import path from 'path'

const packageJson = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../package.json'), 'utf-8'))

// CTRL + K CTRL + 4 to fold operations levels

// In v6 the API only needs the plugin's name, version and processingConfigSchema.
type ApiDocPlugin = { name: string, version: string, processingConfigSchema?: Record<string, unknown> }

export default (origin: string, options?: { processing?: Processing, plugin?: ApiDocPlugin }) => {
  if (options?.plugin?.processingConfigSchema) ProcessingSchema.properties.config = options?.plugin?.processingConfigSchema

  const doc: Record<string, any> = {
    openapi: '3.1.1',
    info: {
      title: options?.processing?.title ? `API du traitement : ${options.processing.title}` : 'API Traitements de données',
      description: `Cette documentation interactive à destination des développeurs permet d'utiliser l'API du ${options?.processing?.title ? `traitement ${options.processing.title}` : 'service de traitements periodiques'}.`,
      version: packageJson.version,
      termsOfService: 'https://koumoul.com/pages/conditions-generales-dutilisation'
    },
    servers: [{
      url: `${origin}/processings/api/v1${options?.processing?._id ? `/processings/${options.processing?._id}` : ''}`,
      description: `Instance DataFair - ${new URL(origin).hostname}`
    }],
    paths: {
      [options?.processing?._id ? '/api-docs.json' : '/admin/api-docs.json']: {
        get: {
          summary: 'Obtenir la documentation OpenAPI',
          description: 'Accéder à cette documentation au format OpenAPI v3.',
          operationId: 'getApiDoc',
          responses: {
            200: {
              description: 'La documentation de l\'API',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            }
          }
        }
      },

      '/processings': {
        get: {
          summary: 'Obtenir la liste des traitements',
          description: 'Accéder à la liste des traitements.',
          operationId: 'getProcessings',
          tags: ['Traitements'],
          parameters: [
            {
              name: 'select',
              in: 'query',
              description: 'Champs à inclure dans la réponse.',
              schema: {
                type: 'string',
                title: 'Sélection des champs'
              }
            },
            {
              name: 'q',
              in: 'query',
              description: 'Recherche textuelle.',
              schema: {
                type: 'string',
                title: 'Recherche textuelle'
              }
            },
            {
              name: 'size',
              in: 'query',
              description: 'Nombre maximum d\'éléments à retourner.',
              schema: {
                type: 'integer',
                title: 'Taille de la page',
                minimum: 1,
                default: 10
              }
            },
            {
              name: 'page',
              in: 'query',
              description: 'Numéro de la page à retourner.',
              schema: {
                type: 'integer',
                title: 'Numéro de la page'
              }
            },
            {
              name: 'skip',
              in: 'query',
              description: 'Nombre d\'éléments à ignorer.',
              schema: {
                type: 'integer',
                title: 'Éléments à ignorer'
              }
            },
            {
              name: 'sort',
              in: 'query',
              description: 'Ordre de tri des résultats.',
              schema: {
                type: 'string',
                title: 'Ordre de tri',
                example: 'field1,-field2'
              }
            },
            {
              name: 'statuses',
              in: 'query',
              description: 'Filtrer par statut de traitement.',
              schema: {
                type: 'string',
                title: 'Statuts des traitements',
                enum: [
                  'none',
                  'error',
                  'scheduled',
                  'killed',
                  'finished'
                ]
              }
            },
            {
              name: 'plugins',
              in: 'query',
              description: 'Filtrer par plugin utilisé.',
              schema: {
                type: 'string',
                title: 'Plugins'
              }
            },
            {
              name: 'owner',
              in: 'query',
              description: 'Filtrer par propriétaire des traitements.',
              schema: {
                type: 'string',
                title: 'Propriétaire'
              }
            }
          ],
          responses: {
            200: {
              description: 'La liste des traitements',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      count: {
                        type: 'integer',
                        description: 'Le nombre de traitements trouvés.'
                      },
                      facets: {
                        type: 'object',
                        properties: {
                          plugins: {
                            type: 'object',
                            additionalProperties: {
                              type: 'integer',
                              description: 'Le nombre de traitements par plugins'
                            }
                          },
                          statuses: {
                            type: 'object',
                            additionalProperties: {
                              type: 'integer',
                              description: 'Le nombre de traitements par statut'
                            }
                          },
                        }
                      },
                      results: {
                        type: 'array',
                        items: ProcessingSchema
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Créer un traitement',
          description: 'Créer un traitement.',
          operationId: 'postProcessing',
          tags: ['Traitements'],
          requestBody: {
            description: 'Le traitement à créer',
            required: true,
            content: {
              'application/json': {
                schema: jsonSchema(ProcessingSchema)
                  .pickProperties(['owner', 'pluginId', 'title'])
                  .removeFromRequired(['scheduling', '_id'])
                  .removeId()
                  .appendTitle(' post')
                  .schema,
                example: {
                  pluginId: '@data-fair/processing-export-file@1',
                  owner: {
                    type: 'organization',
                    id: 'koumoul',
                    name: 'Koumoul',
                    department: 'dep1',
                    departmentName: 'Department 1'
                  },
                  title: 'Export File'
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Le traitement a été créé avec succès.',
              content: {
                'application/json': {
                  schema: ProcessingSchema
                }
              }
            },
            400: {
              description: 'Body de la requête invalide.'
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de créer ce traitement.'
            }
          }
        }
      },
      '/processings/{id}': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'L\'identifiant du traitement.',
            schema: {
              type: 'string',
              title: 'Identifiant du traitement'
            }
          }
        ],
        get: {
          summary: 'Lire les informations d\'un traitement',
          description: 'Accéder aux données d\'un traitement.',
          operationId: 'getProcessing',
          tags: ['Traitements'],
          responses: {
            200: {
              description: 'Le traitement trouvé.',
              content: {
                'application/json': {
                  schema: ProcessingSchema
                }
              }
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de voir ce traitement.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        },
        patch: {
          summary: 'Mettre à jour un traitement',
          description: 'Mettre à jour un traitement.',
          operationId: 'patchProcessing',
          tags: ['Traitements'],
          requestBody: {
            description: 'Le traitement à mettre à jour',
            required: true,
            content: {
              'application/json': {
                schema: ProcessingSchema
              }
            }
          },
          responses: {
            200: {
              description: 'Le traitement a été mis à jour avec succès.',
              content: {
                'application/json': {
                  schema: ProcessingSchema
                }
              }
            },
            400: {
              description: 'Body de la requête invalide.'
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de mettre à jour ce traitement ou de faire cette modification sur ce traitement'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        },
        delete: {
          summary: 'Supprimer un traitement',
          description: 'Supprimer un traitement.',
          operationId: 'deleteProcessing',
          tags: ['Traitements'],
          responses: {
            204: {
              description: 'Le traitement a été supprimé avec succès.'
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de supprimer ce traitement.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        }
      },
      '/processings/{id}/webhook-key': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'L\'identifiant du traitement.',
            schema: {
              type: 'string',
              title: 'Identifiant du traitement'
            }
          }
        ],
        get: {
          summary: 'Lire la clé de webhook d\'un traitement',
          description: 'Lire la clé de webhook d\'un traitement.',
          operationId: 'getProcessingWebhookKey',
          tags: ['Traitements'],
          responses: {
            200: {
              description: 'La clé de webhook du traitement.',
              content: {
                'application/json': {
                  schema: {
                    type: 'string'
                  }
                }
              }
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de voir ce traitement.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        },
        delete: {
          summary: 'Recréer la clé de webhook d\'un traitement',
          description: 'Recréer la clé de webhook d\'un traitement.',
          operationId: 'deleteProcessingWebhookKey',
          tags: ['Traitements'],
          responses: {
            200: {
              description: 'La clé de webhook du traitement a été recréée avec succès.',
              content: {
                'application/json': {
                  schema: {
                    type: 'string',
                    description: 'La nouvelle clé de webhook du traitement.'
                  }
                }
              }
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de voir ce traitement.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        }
      },
      '/processings/{id}/_trigger': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'L\'identifiant du traitement.',
            schema: {
              type: 'string',
              title: 'Identifiant du traitement'
            }
          }
        ],
        post: {
          summary: 'Déclencher un traitement manuellement',
          description: 'Déclencher un traitement manuellement.',
          operationId: 'postProcessingTrigger',
          tags: ['Traitements'],
          parameters: [
            {
              name: 'key',
              in: 'query',
              description: 'La clé de déclenchement du traitement.',
              schema: {
                type: 'string',
                title: 'Clé de déclenchement'
              }
            }
          ],
          responses: {
            200: {
              description: 'Le traitement a été déclenché avec succès.'
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de déclencher ce traitement, ou la clé de déclenchement n\'est pas valide.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        }
      },

      // Simplified routes when processing?._id is set
      '/': {
        get: {
          summary: 'Lire les informations de ce traitement',
          description: 'Accéder aux données de ce traitement.',
          operationId: 'getProcessing',
          responses: {
            200: {
              description: 'Le traitement trouvé.',
              content: {
                'application/json': {
                  schema: ProcessingSchema
                }
              }
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de voir ce traitement.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        },
        patch: {
          summary: 'Mettre à jour ce traitement',
          description: 'Mettre à jour ce traitement.',
          operationId: 'patchProcessing',
          requestBody: {
            description: 'Le traitement à mettre à jour',
            required: true,
            content: {
              'application/json': {
                schema: jsonSchema(ProcessingSchema)
                  .pickProperties(['title', 'active', 'config', 'owner', 'scheduling', 'permissions'])
                  .removeRequired()
                  .removeId()
                  .appendTitle(' patch')
                  .schema,
                example: options?.processing
                  ? {
                      title: options.processing.title,
                      active: options.processing.active,
                      config: options.processing.config,
                      owner: options.processing.owner,
                      scheduling: options.processing.scheduling,
                      permissions: options.processing.permissions
                    }
                  : {}
              }
            }
          },
          responses: {
            200: {
              description: 'Le traitement a été mis à jour avec succès.',
              content: {
                'application/json': {
                  schema: ProcessingSchema
                }
              }
            },
            400: {
              description: 'Body de la requête invalide.'
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de mettre à jour ce traitement ou de faire cette modification sur ce traitement'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        },
        delete: {
          summary: 'Supprimer ce traitement',
          description: 'Supprimer ce traitement.',
          operationId: 'deleteProcessing',
          responses: {
            204: {
              description: 'Le traitement a été supprimé avec succès.'
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de supprimer ce traitement.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        }
      },
      '/webhook-key': {
        get: {
          summary: 'Lire la clé de webhook de ce traitement',
          description: 'Lire la clé de webhook de ce traitement.',
          operationId: 'getProcessingWebhookKey',
          responses: {
            200: {
              description: 'La clé de webhook du traitement.',
              content: {
                'application/json': {
                  schema: {
                    type: 'string'
                  }
                }
              }
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de voir ce traitement.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        },
        delete: {
          summary: 'Recréer la clé de webhook de ce traitement',
          description: 'Recréer la clé de webhook de ce traitement.',
          operationId: 'deleteProcessingWebhookKey',
          responses: {
            200: {
              description: 'La clé de webhook du traitement a été recréée avec succès.',
              content: {
                'application/json': {
                  schema: {
                    type: 'string',
                    description: 'La nouvelle clé de webhook du traitement.'
                  }
                }
              }
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de voir ce traitement.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        }
      },
      '/_trigger': {
        post: {
          summary: 'Déclencher ce traitement manuellement',
          description: 'Déclencher ce traitement manuellement.',
          operationId: 'postProcessingTrigger',
          parameters: [
            {
              name: 'key',
              in: 'query',
              description: 'La clé de déclenchement du traitement.',
              schema: {
                type: 'string',
                title: 'Clé de déclenchement'
              }
            }
          ],
          responses: {
            200: {
              description: 'Le traitement a été déclenché avec succès.'
            },
            403: {
              description: 'L\'utilisateur n\'a pas le droit de déclencher ce traitement, ou la clé de déclenchement n\'est pas valide.'
            },
            404: {
              description: 'Traitement non trouvé.'
            }
          }
        }
      },
    }
  }

  if (options?.processing?._id) {
    const pathsToKeep = ['/', '/webhook-key', '/_trigger', '/api-docs.json']
    const filteredPaths: any = {}
    pathsToKeep.forEach(path => {
      if (doc.paths[path]) filteredPaths[path] = doc.paths[path]
    })
    doc.paths = filteredPaths
  } else {
    delete doc.paths['/']
    delete doc.paths['/webhook-key']
    delete doc.paths['/_trigger']
  }

  return doc
}
