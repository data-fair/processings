import jsonSchema from '@data-fair/lib-utils/json-schema.js'
import PluginSchema from '#types/plugin/schema.js'
import { resolvedSchema as ProcessingSchema } from '#types/processing/index.ts'
import { readFileSync } from 'node:fs'
import path from 'path'

const packageJson = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf-8'))

// CTRL + K CTRL + 4 to fold operations levels

export default (origin: string, options?: { isSuperAdmin?: boolean, processingId?: string }) => {
  const doc: Record<string, any> = {
    openapi: '3.1.1',
    info: {
      title: 'API Traitements de données',
      description: 'Cette documentation interactive à destination des développeurs permet d\'utiliser l\'API du service de traitements periodiques.',
      version: packageJson.version,
      termsOfService: 'https://koumoul.com/pages/conditions-generales-dutilisation',
      // contact: {
      //   name: 'Koumoul',
      //   url: 'https://koumoul.com',
      //   email: 'support@koumoul.com'
      // }
    },
    servers: [{
      url: `${origin}/processings/api/v1${options?.processingId ? `/processings/${options.processingId}` : ''}`,
      description: `Instance DataFair - ${new URL(origin).hostname}`
    }],
    paths: {
      [options?.processingId ? `/processings/${options.processingId}/api-docs.json` : options?.isSuperAdmin ? '/admin/api-docs.json' : '/processings/api-docs.json']: {
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
                  .pickProperties(['owner', 'plugin', 'title'])
                  .removeFromRequired(['scheduling', '_id'])
                  .removeId()
                  .appendTitle(' post')
                  .schema,
                example: {
                  plugin: '@data-fair/processing-export-file',
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
          summary: 'Obtenir un traitement',
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
          summary: 'Obtenir la clé de webhook d\'un traitement',
          description: 'Obtenir la clé de webhook d\'un traitement.',
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
          summary: 'Régénérer la clé de webhook d\'un traitement',
          description: 'Régénérer la clé de webhook d\'un traitement.',
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
              required: true,
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

      // Simplified routes when processingId is set
      '/': {
        get: {
          summary: 'Obtenir ce traitement',
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
          summary: 'Obtenir la clé de webhook de ce traitement',
          description: 'Obtenir la clé de webhook de ce traitement.',
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
          summary: 'Régénérer la clé de webhook de ce traitement',
          description: 'Régénérer la clé de webhook de ce traitement.',
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
              required: true,
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

      '/plugins-registry': {
        get: {
          summary: 'Obtenir la liste des plugins',
          description: 'Accéder à la liste des plugins disponibles sur NPM.',
          operationId: 'getPluginsRegistry',
          tags: ['Plugins'],
          parameters: [
            {
              name: 'q',
              in: 'query',
              description: 'Le nom du plugin à rechercher.',
              schema: {
                type: 'string',
                title: 'Nom du plugin à rechercher'
              }
            },
            {
              name: 'showAll',
              in: 'query',
              description: 'Afficher tous les plugins disponibles (même ceux en version bêta). La requête peut prendre plus de temps.',
              schema: {
                type: 'boolean',
                title: 'Afficher tous les plugins disponibles'
              }
            }
          ],
          responses: {
            200: {
              description: 'La liste des plugins disponibles',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      count: {
                        type: 'integer',
                        description: 'Le nombre de plugins trouvés.'
                      },
                      results: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: {
                              type: 'string',
                              description: 'Le nom du plugin.'
                            },
                            description: {
                              type: 'string',
                              description: 'La description du plugin.'
                            },
                            version: {
                              type: 'string',
                              description: 'La version du plugin.'
                            },
                            distTag: {
                              type: 'string',
                              description: 'Le tag de distribution du plugin.',
                              example: 'latest'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: 'Requête invalide, le paramètre "q" est mal formaté.'
            },
            429: {
              description: 'Erreur renvoyée par l\'API NPM, trop de requêtes envoyées.'
            },
            500: {
              description: 'Erreur interne (Il se peut que le service NPM soit indisponible).'
            }
          }
        }
      },
      '/plugins': {
        get: {
          summary: 'Obtenir la liste des plugins installés',
          description: 'Accéder à la liste des plugins installés.',
          operationId: 'getPlugins',
          tags: ['Plugins'],
          parameters: [
            {
              name: 'privateAccess',
              in: 'query',
              description: 'Filtre par accès',
              schema: {
                type: 'string',
                title: 'Filtre par accès',
                example: 'type:id'
              }
            }
          ],
          responses: {
            200: {
              description: 'La liste des plugins installés',
              content: {
                'application/json': {
                  schema: {
                    count: {
                      type: 'integer',
                      description: 'Le nombre de plugins trouvés.'
                    },
                    facets: {
                      type: 'object',
                      properties: {
                        usages: {
                          type: 'object',
                          additionalProperties: {
                            type: 'integer',
                            description: 'Le nombre de fois que le plugin est utilisé'
                          }
                        }
                      }
                    },
                    results: {
                      type: 'array',
                      items: PluginSchema
                    }
                  }
                }
              }
            },
            400: {
              description: 'Le paramètre "privateAccess" est manquant et l\'utilisateur n\'est pas super administrateur.'
            },
            403: {
              description: 'Le privateAccess ne correspond pas avec l\'utilisateur authentifié.'
            }
          }
        },
        post: {
          summary: 'Installer un plugin',
          description: 'Installer/Mettre à jours un plugin, voir même baisser en version un plugin. Cette requête prends beaucoup de temps à s\'executer, c\'est le temps que le plugin s\'installe sur le serveur.',
          operationId: 'postPlugin',
          tags: ['Plugins'],
          requestBody: {
            description: 'Le plugin à installer',
            required: true,
            content: {
              'application/json': {
                schema: jsonSchema(PluginSchema)
                  .pickProperties(['distTag', 'name', 'version', 'description'])
                  .removeFromRequired(['description'])
                  .removeId()
                  .appendTitle(' post')
                  .schema,
                example: {
                  name: '@data-fair/processing-export-file',
                  description: 'Export File',
                  version: '0.6.2',
                  distTag: 'latest'
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Le plugin a été installé avec succès.',
              content: {
                'application/json': {
                  schema: PluginSchema
                }
              }
            }
          }
        }
      },
      '/plugins/{id}': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'L\'identifiant du plugin.',
            schema: {
              type: 'string',
              title: 'Identifiant du plugin'
            }
          }
        ],
        get: {
          summary: 'Obtenir un plugin',
          description: 'Accéder aux données d\'un plugin.',
          operationId: 'getPlugin',
          tags: ['Plugins'],
          responses: {
            200: {
              description: 'Le plugin trouvé.',
              content: {
                'application/json': {
                  schema: PluginSchema
                }
              }
            },
            404: {
              description: 'Plugin non trouvé.'
            }
          }
        },
        delete: {
          summary: 'Supprimer un plugin',
          description: 'Supprimer un plugin.',
          operationId: 'deletePlugin',
          tags: ['Plugins'],
          responses: {
            204: {
              description: 'Le plugin a été supprimé avec succès.'
            }
          }
        },
      },
      '/plugins/{id}/config': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'L\'identifiant du plugin.',
            schema: {
              type: 'string',
              title: 'Identifiant du plugin'
            }
          }
        ],
        put: {
          summary: 'Mettre à jour la configuration d\'un plugin',
          description: 'Mettre à jour la configuration d\'un plugin.',
          operationId: 'putPluginConfig',
          tags: ['Plugins'],
          requestBody: {
            description: 'La configuration du plugin',
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          },
        }
      },
      '/plugins/{id}/metadata': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'L\'identifiant du plugin.',
            schema: {
              type: 'string',
              title: 'Identifiant du plugin'
            }
          }
        ],
        put: {
          summary: 'Mettre à jour les métadonnées d\'un plugin',
          description: 'Mettre à jour les métadonnées d\'un plugin.',
          operationId: 'putPluginMetadata',
          tags: ['Plugins'],
          requestBody: {
            description: 'Les métadonnées du plugin',
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          },
        }
      },
      '/plugins/{id}/access': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'L\'identifiant du plugin.',
            schema: {
              type: 'string',
              title: 'Identifiant du plugin'
            }
          }
        ],
        put: {
          summary: 'Mettre à jour les accès d\'un plugin',
          description: 'Mettre à jour les accès d\'un plugin.',
          operationId: 'putPluginAccess',
          tags: ['Plugins'],
          requestBody: {
            description: 'les accès du plugin',
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          },
        }
      }
    }
  }

  // Remove super admin routes if not super admin
  if (!options?.isSuperAdmin) {
    delete doc.paths['/plugins-registry']
    delete doc.paths['/plugins'].post
    delete doc.paths['/plugins/{id}'].delete
    delete doc.paths['/plugins/{id}/config']
    delete doc.paths['/plugins/{id}/metadata']
    delete doc.paths['/plugins/{id}/access']
  }

  if (options?.processingId) {
    delete doc.paths['/processings']
    delete doc.paths['/plugins']
    delete doc.paths['/plugins/{id}']

    // Delete routes with id if processingId is set
    delete doc.paths['/processings/{id}']
    delete doc.paths['/processings/{id}/webhook-key']
    delete doc.paths['/processings/{id}/_trigger']
  } else {
    delete doc.paths['/']
    delete doc.paths['/webhook-key']
    delete doc.paths['/_trigger']
  }

  return doc
}
