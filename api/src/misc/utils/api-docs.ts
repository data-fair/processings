import jsonSchema from '@data-fair/lib-utils/json-schema.js'
import { type Processing, resolvedSchema } from '#types/processing/index.ts'
import { readFileSync } from 'node:fs'
import path from 'path'

const packageJson = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../package.json'), 'utf-8'))

// CTRL + K CTRL + 4 to fold operations levels

// In v6 the API only needs the plugin's name, version and processingConfigSchema.
type ApiDocPlugin = { name: string, version: string, processingConfigSchema?: Record<string, unknown> }

// The API documentation of one processing (the service's own document is api/contract/api-docs.ts)
export default (origin: string, options: { processing: Processing, plugin?: ApiDocPlugin }) => {
  // a copy: the resolved schema is shared by the whole api
  const ProcessingSchema = structuredClone(resolvedSchema)
  if (options.plugin?.processingConfigSchema) ProcessingSchema.properties.config = options.plugin.processingConfigSchema

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
      '/api-docs.json': {
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

  return doc
}
