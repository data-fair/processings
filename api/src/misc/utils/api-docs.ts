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
      title: options?.processing?.title ? `API of the processing: ${options.processing.title}` : 'API Processings',
      description: `This interactive documentation for developers covers the API of the ${options?.processing?.title ? `processing ${options.processing.title}` : 'periodic processings service'}.`,
      version: packageJson.version,
      termsOfService: 'https://koumoul.com/pages/conditions-generales-dutilisation'
    },
    servers: [{
      url: `${origin}/processings/api/v1${options?.processing?._id ? `/processings/${options.processing?._id}` : ''}`,
      description: `Data Fair instance - ${new URL(origin).hostname}`
    }],
    paths: {
      '/api-docs.json': {
        get: {
          summary: 'Get the OpenAPI documentation',
          description: 'Get this documentation in the OpenAPI v3 format.',
          operationId: 'getApiDoc',
          responses: {
            200: {
              description: 'The API documentation.',
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
          summary: 'Read this processing',
          description: 'Read the information of this processing.',
          operationId: 'getProcessing',
          responses: {
            200: {
              description: 'The processing.',
              content: {
                'application/json': {
                  schema: ProcessingSchema
                }
              }
            },
            403: {
              description: 'The user is not allowed to read this processing.'
            },
            404: {
              description: 'Processing not found.'
            }
          }
        },
        patch: {
          summary: 'Update this processing',
          description: 'Update some fields of this processing.',
          operationId: 'patchProcessing',
          requestBody: {
            description: 'The fields of the processing to update.',
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
              description: 'The updated processing.',
              content: {
                'application/json': {
                  schema: ProcessingSchema
                }
              }
            },
            400: {
              description: 'Invalid request body.'
            },
            403: {
              description: 'The user is not allowed to update this processing or to make this change to it.'
            },
            404: {
              description: 'Processing not found.'
            }
          }
        },
        delete: {
          summary: 'Delete this processing',
          description: 'Delete this processing and its runs.',
          operationId: 'deleteProcessing',
          responses: {
            204: {
              description: 'The processing was deleted.'
            },
            403: {
              description: 'The user is not allowed to delete this processing.'
            },
            404: {
              description: 'Processing not found.'
            }
          }
        }
      },
      '/webhook-key': {
        get: {
          summary: 'Read the webhook key of this processing',
          description: 'Read the key that triggers this processing through its webhook.',
          operationId: 'getProcessingWebhookKey',
          responses: {
            200: {
              description: 'The webhook key of the processing.',
              content: {
                'application/json': {
                  schema: {
                    type: 'string'
                  }
                }
              }
            },
            403: {
              description: 'The user is not allowed to read this processing.'
            },
            404: {
              description: 'Processing not found.'
            }
          }
        },
        delete: {
          summary: 'Renew the webhook key of this processing',
          description: 'Replace the webhook key of this processing with a new one, the previous key stops working.',
          operationId: 'deleteProcessingWebhookKey',
          responses: {
            200: {
              description: 'The webhook key was renewed.',
              content: {
                'application/json': {
                  schema: {
                    type: 'string',
                    description: 'The new webhook key of the processing.'
                  }
                }
              }
            },
            403: {
              description: 'The user is not allowed to read this processing.'
            },
            404: {
              description: 'Processing not found.'
            }
          }
        }
      },
      '/_trigger': {
        post: {
          summary: 'Trigger this processing',
          description: 'Trigger a run of this processing now, with a session or with its webhook key.',
          operationId: 'postProcessingTrigger',
          parameters: [
            {
              name: 'key',
              in: 'query',
              description: 'The webhook key of the processing, to trigger it without a session.',
              schema: {
                type: 'string',
                title: 'Webhook key'
              }
            }
          ],
          responses: {
            200: {
              description: 'The processing was triggered.'
            },
            403: {
              description: 'The user is not allowed to trigger this processing, or the webhook key is invalid.'
            },
            404: {
              description: 'Processing not found.'
            }
          }
        }
      },
    }
  }

  return doc
}
