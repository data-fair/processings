/**
 * The OpenAPI document of this service, served at /processings/api/v1/api-docs.json.
 *
 * It is public and origin independent: data-fair fetches it over a private url and merges it into its
 * platform document (paths under /processings/api/v1, tools and skills prefixed processings_), so agents
 * of the deployment can configure processings and follow their runs through `@data-fair/openapi-mcp`.
 *
 * Every operation is an entry of scopedOperations (api/src/scopes.ts): the oauth2 scheme declares the
 * scopes processings enforces, and each operation lists every scope it accepts as its own security
 * alternative (standard OpenAPI: the scopes of one requirement are all needed).
 *
 * The agent-facing surface it produces is pinned by tests/fixtures/agent-surface.json.
 */
import { oauth2SecurityScheme, oauth2Alternatives, type ScopeLocale } from '@data-fair/lib-common-types/scopes.js'
import { resolvedSchema as processingSchema } from '#types/processing/index.ts'
import { resolvedSchema as runSchema } from '#types/run/index.ts'
import { resolvedSchema as limitSchema } from '#types/limit/index.ts'
import processingsGetReq from '../doc/processings/get-req/schema.json' with { type: 'json' }
import runsGetReq from '../doc/runs/get-req/schema.json' with { type: 'json' }
import { vocabulary, acceptedScopes, scopedOperations, type ScopedOperationId } from '../src/scopes.ts'
import { processingPatchFields } from '../src/processings/patch-fields.ts'
import { root, operations as agentOperations } from './x-agent.ts'

// the resolved schemas as OpenAPI components: no $id, no build annotations, no vjsf layout
const stripExports = (value: any): any => {
  if (Array.isArray(value)) return value.map(stripExports)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'x-exports').map(([k, v]) => [k, stripExports(v)]))
  }
  return value
}
const component = (schema: Record<string, any>) => {
  const { $id, $defs, layout, ...rest } = stripExports(schema)
  return rest
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const processingComponent = component(processingSchema)
// the config follows the schema of the processing's plugin, read with getPluginConfigSchema
processingComponent.properties.config = { type: 'object', description: 'The config of the plugin, its schema is returned by getPluginConfigSchema.' }
// written by the worker, not part of the stored schema
processingComponent.properties.lastRun = { ...ref('run'), readOnly: true, description: 'The last run of the processing.' }
processingComponent.properties.nextRun = { ...ref('run'), readOnly: true, description: 'The next scheduled run of the processing.' }

const json = (description: string, schema: Record<string, any>) => ({ description, content: { 'application/json': { schema } } })
const idParam = (description: string) => ({ in: 'path', name: 'id', required: true, description, schema: { type: 'string' } })

const queryDescriptions: Record<string, string> = {
  size: 'Number of results per page.',
  page: 'Page number, starting at 1.',
  skip: 'Number of results to skip.',
  showAll: 'true to list the processings of every account (superadmin only).',
  sort: 'Sort keys, comma separated, prefixed by - for descending order (e.g. -updated.date).',
  select: 'Fields to return, comma separated.',
  q: 'Full text search.',
  statuses: 'Statuses of the last run, comma separated (e.g. error,finished).',
  plugins: 'Plugin ids, comma separated.',
  owner: 'Owners, comma separated, as type:id or type:id:department (e.g. organization:myorg).',
  processing: 'Id of the processing whose runs are listed.'
}
const queryParams = (schema: { properties: Record<string, any> }) => Object.entries(schema.properties).map(([name, s]) => ({
  in: 'query', name, required: false, description: queryDescriptions[name], schema: s
}))

const editableProperties = (fields: readonly string[]) => Object.fromEntries(fields.map(f => [f, processingComponent.properties[f]]))

// the security of an operation: the cookie session, or a token holding one of the scopes it accepts
const operationSecurity = (operationId: ScopedOperationId) => {
  const { family, tier } = scopedOperations[operationId]
  return [{ sdCookie: [] }, ...oauth2Alternatives(acceptedScopes(family, tier))]
}

type Operation = Record<string, any> & { tags: string[] }
const operations: Record<ScopedOperationId, Operation> = {
  listProcessings: {
    summary: 'List processings',
    description: 'List the processings the session can read, with facets on their statuses, plugins and owners.',
    tags: ['processings'],
    parameters: queryParams(processingsGetReq),
    responses: { 200: json('A page of processings.', { type: 'object', properties: { count: { type: 'integer' }, results: { type: 'array', items: ref('processing') }, facets: { type: 'object' } } }) }
  },
  postProcessing: {
    summary: 'Create a processing',
    description: 'Create a processing of a plugin. The owner defaults to the active account; the processing is inactive until it has a valid config.',
    tags: ['processings'],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object', required: ['title', 'plugin'], properties: editableProperties(['title', 'plugin', 'owner', ...processingPatchFields.write]) } } }
    },
    responses: { 200: json('The created processing.', ref('processing')) }
  },
  getProcessing: {
    summary: 'Read a processing',
    description: 'Its config, permissions and webhook key are only returned to the admins of the processing.',
    tags: ['processings'],
    parameters: [idParam('Id of the processing.')],
    responses: { 200: json('The processing.', ref('processing')) }
  },
  patchProcessing: {
    summary: 'Update a processing',
    description: 'Update some parts of a processing. permissions and owner need the admin tier of the processings scopes. A null value removes a part.',
    tags: ['processings'],
    parameters: [idParam('Id of the processing.')],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { type: 'object', properties: editableProperties([...processingPatchFields.write, ...processingPatchFields.admin]) } } }
    },
    responses: { 200: json('The updated processing.', ref('processing')) }
  },
  deleteProcessing: {
    summary: 'Delete a processing',
    description: 'Delete a processing and its runs.',
    tags: ['processings'],
    parameters: [idParam('Id of the processing.')],
    responses: { 204: { description: 'The processing is deleted.' } }
  },
  getProcessingConfig: {
    summary: 'Read the config of a processing',
    description: 'The config follows the schema returned by getPluginConfigSchema. Admins of the processing only.',
    tags: ['processings'],
    parameters: [idParam('Id of the processing.')],
    responses: { 200: json('The config, an empty object when the processing has none.', { type: 'object' }) }
  },
  putProcessingConfig: {
    summary: 'Replace the config of a processing',
    description: 'Replace the whole config, validated against the schema returned by getPluginConfigSchema. Admins of the processing only.',
    tags: ['processings'],
    parameters: [idParam('Id of the processing.')],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
    responses: { 200: json('The saved config.', { type: 'object' }) }
  },
  getPluginConfigSchema: {
    summary: 'Read the config schema of a processing',
    description: 'The JSON schema of the config of the processing, defined by its plugin.',
    tags: ['processings'],
    parameters: [
      idParam('Id of the processing.'),
      { in: 'query', name: 'agent', required: false, description: 'true for the schema in json-layout v3 syntax, with the urls and owner filters of its layout resolved.', schema: { type: 'boolean' } }
    ],
    responses: { 200: json('A JSON schema.', { type: 'object' }) }
  },
  getProcessingPlugin: {
    summary: 'Read the plugin of a processing',
    description: 'The metadata of the plugin version the processing runs.',
    tags: ['processings'],
    parameters: [idParam('Id of the processing.')],
    responses: { 200: json('The plugin metadata.', { type: 'object' }) }
  },
  getProcessingWebhookKey: {
    summary: 'Read the webhook key of a processing',
    description: 'The key that triggers the processing without credentials (triggerProcessing with key).',
    tags: ['processings'],
    parameters: [idParam('Id of the processing.')],
    responses: { 200: { description: 'The key.', content: { 'text/plain': { schema: { type: 'string' } } } } }
  },
  deleteProcessingWebhookKey: {
    summary: 'Renew the webhook key of a processing',
    description: 'Replace the webhook key by a new one, the previous key stops working.',
    tags: ['processings'],
    parameters: [idParam('Id of the processing.')],
    responses: { 200: { description: 'The new key.', content: { 'text/plain': { schema: { type: 'string' } } } } }
  },
  triggerProcessing: {
    summary: 'Trigger a run',
    description: 'Run an active processing now, or after a delay. With a webhook key the call needs no credentials.',
    tags: ['processings'],
    parameters: [
      idParam('Id of the processing.'),
      { in: 'query', name: 'key', required: false, description: 'The webhook key of the processing, instead of a session.', schema: { type: 'string' } },
      { in: 'query', name: 'delay', required: false, description: 'Delay before the run, in seconds.', schema: { type: 'integer', minimum: 0 } }
    ],
    responses: {
      200: json('The triggered run.', ref('run')),
      409: { description: 'The processing is not active.' }
    }
  },
  listRuns: {
    summary: 'List runs',
    description: 'List the runs of the processings the session can read, most recent first. Logs are not included.',
    tags: ['runs'],
    parameters: queryParams(runsGetReq),
    responses: { 200: json('A page of runs.', { type: 'object', properties: { count: { type: 'integer' }, results: { type: 'array', items: ref('run') } } }) }
  },
  getRun: {
    summary: 'Read a run',
    description: 'A run with its logs.',
    tags: ['runs'],
    parameters: [idParam('Id of the run.')],
    responses: { 200: json('The run.', ref('run')) }
  },
  killRun: {
    summary: 'Kill a run',
    description: 'Ask the worker to stop a running run.',
    tags: ['runs'],
    parameters: [idParam('Id of the run.')],
    responses: { 200: json('The run, in kill status.', ref('run')) }
  },
  getAccountLimits: {
    summary: 'Read the limits of an account',
    description: 'The processing time quota of an account and its consumption. Members of the account only.',
    tags: ['limits'],
    parameters: [
      { in: 'path', name: 'type', required: true, description: 'user or organization.', schema: { type: 'string', enum: ['user', 'organization'] } },
      { in: 'path', name: 'id', required: true, description: 'Id of the account.', schema: { type: 'string' } }
    ],
    responses: { 200: json('The limits.', ref('limit')) }
  }
}

const tagTitles = {
  processings: { fr: 'Traitements', en: 'Processings' },
  runs: { fr: 'Exécutions', en: 'Runs' },
  limits: { fr: 'Limites', en: 'Limits' }
}

export default (locale: ScopeLocale = 'fr') => {
  const paths: Record<string, Record<string, any>> = {}
  for (const [operationId, { method, path }] of Object.entries(scopedOperations)) {
    const operation = operations[operationId as ScopedOperationId]
    paths[path] = paths[path] ?? {}
    paths[path][method] = {
      operationId,
      ...operation,
      tags: operation.tags.map(tag => tagTitles[tag as keyof typeof tagTitles][locale]),
      security: operationSecurity(operationId as ScopedOperationId),
      ...(operationId in agentOperations ? { 'x-agent': agentOperations[operationId as keyof typeof agentOperations] } : {})
    }
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'API Processings',
      description: 'Periodic processings: plugins that ingest, transform and publish datasets, their configs and their runs.',
      version: '1.0.0'
    },
    // no request origin: data-fair fetches this document over a private url and prefixes the paths itself
    'x-agent': root,
    servers: [{ url: '/processings/api/v1' }],
    components: {
      securitySchemes: {
        sdCookie: { type: 'apiKey', in: 'cookie', name: 'id_token' },
        // relative token url, data-fair sets the one of each site
        oauth2: oauth2SecurityScheme(vocabulary, { directoryUrl: '/simple-directory', locale })
      },
      schemas: {
        processing: processingComponent,
        run: component(runSchema),
        limit: component(limitSchema)
      }
    },
    security: [{ sdCookie: [] }],
    tags: Object.values(tagTitles).map(t => ({ name: t[locale] })),
    paths
  }
}
