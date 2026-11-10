/**
 * The x-agent annotations of the OpenAPI document (api-docs.ts): one tool per purpose, named as
 * data-fair's platform merge prefixes them (processings_<name>). Vocabulary: docs/x-agent.md of
 * `@data-fair/openapi-mcp`. Operations without an entry here are not offered as tools.
 */
import type { AgentOperation, AgentOperationAnnotation, AgentRoot } from '@data-fair/openapi-mcp'
import { oauth2Alternatives } from '@data-fair/lib-common-types/scopes.js'
import { acceptedScopes, type ScopedOperationId } from '../src/scopes.ts'
import { processingPatchFields } from '../src/processings/patch-fields.ts'

const listProcessings = {
  name: 'list_processings',
  title: { en: 'List processings', fr: 'Lister les traitements' },
  description: 'List the processings of the active account: periodic or on-demand tasks that run a plugin to ingest, transform or publish datasets. Each result tells its plugin, whether it is active, its last run and next scheduled run, and the profile of the caller on it (admin, exec or read). Use describe_processing for one processing.',
  annotations: { readOnlyHint: true, openWorldHint: false },
  params: {
    q: { description: 'Full text search on the titles.' },
    statuses: { description: 'Statuses of the last run, comma separated: triggered, scheduled, running, error, finished, kill, killed.' },
    plugins: { description: 'Plugin ids, comma separated.' },
    size: { default: 10, maximum: 50, description: 'Number of processings per page.' },
    page: { default: 1, description: 'Page number, starting at 1.' },
    select: { exclude: true },
    skip: { exclude: true },
    sort: { exclude: true },
    owner: { exclude: true },
    showAll: { exclude: true }
  },
  response: { rows: '/results', concise: ['_id', 'title', 'plugin', 'active', 'lastRun', 'nextRun', 'userProfile'], detailed: true }
} satisfies AgentOperation

const describeProcessing = {
  name: 'describe_processing',
  title: { en: 'Describe a processing', fr: 'Décrire un traitement' },
  description: 'Read a processing: its plugin, scheduling, activation, last and next runs. Its config and permissions are included when the caller is an admin of the processing.',
  annotations: { readOnlyHint: true, openWorldHint: false }
} satisfies AgentOperation

const createProcessing = {
  name: 'create_processing',
  title: { en: 'Create a processing', fr: 'Créer un traitement' },
  description: 'Create a processing of a plugin. The plugin id is the _id of a processing artefact found with registry_search_artefacts (category processing). The owner defaults to the active account. The processing is created inactive and without config: fill the config next with the processing_config tools, then activate it with update_processing.',
  annotations: { openWorldHint: false },
  bodyFields: ['title', 'plugin', 'owner'],
  bodyRequired: ['title', 'plugin']
} satisfies AgentOperation

const updateProcessing = {
  name: 'update_processing',
  title: { en: 'Update a processing', fr: 'Modifier un traitement' },
  description: 'Rename a processing, activate or deactivate it, or replace its scheduling. A processing needs a valid config to be activated. The scheduling is the whole list of its schedules, an empty list for on-demand runs only. Use the processing_config tools for its config.',
  annotations: { openWorldHint: false },
  bodyFields: ['title', 'active', 'scheduling']
} satisfies AgentOperation

const updateProcessingPermissions = {
  name: 'update_processing_permissions',
  title: { en: 'Update the permissions of a processing', fr: 'Modifier les permissions d\'un traitement' },
  description: 'Replace the whole permissions list of a processing, which gives other users or partner organizations a read or exec profile on it, or give the processing to another owner. Read the current permissions first with describe_processing: the list sent replaces them all.',
  annotations: { destructiveHint: true, openWorldHint: false },
  bodyFields: [...processingPatchFields.admin],
  // the admin parts of the body need the admin tier, the operation accepts the write tier
  security: [{ sdCookie: [] }, ...oauth2Alternatives(acceptedScopes('processings', 'admin'))]
} satisfies AgentOperation

const processingConfig = {
  name: 'processing_config',
  title: { en: 'Processing config', fr: 'Configuration d\'un traitement' },
  description: 'Edit the config of a processing, a form defined by the schema of its plugin.',
  annotations: { openWorldHint: false },
  editor: { schemaOperation: 'getPluginConfigSchema', schemaParams: { agent: true }, readOperation: 'getProcessingConfig' }
} satisfies AgentOperation

const triggerProcessing = {
  name: 'trigger_processing',
  title: { en: 'Trigger a processing', fr: 'Déclencher un traitement' },
  description: 'Run a processing now, or after a delay, out of its scheduling. The processing must be active (an error 409 otherwise). Follow the run with list_runs and describe_run.',
  annotations: { openWorldHint: false },
  params: {
    key: { exclude: true },
    delay: { description: 'Delay before the run starts, in seconds.' }
  }
} satisfies AgentOperation

const listRuns = {
  name: 'list_runs',
  title: { en: 'List runs', fr: 'Lister les exécutions' },
  description: 'List the runs of the processings of the active account, most recent first, without their logs. Each run tells its status (triggered, scheduled, running, error, finished, kill, killed) and its dates. Use describe_run for the log of one run.',
  annotations: { readOnlyHint: true, openWorldHint: false },
  params: {
    processing: { description: 'The _id of the processing whose runs are listed.' },
    size: { default: 10, maximum: 50, description: 'Number of runs per page.' },
    page: { default: 1, description: 'Page number, starting at 1.' },
    select: { exclude: true },
    sort: { exclude: true },
    owner: { exclude: true },
    showAll: { exclude: true },
    skip: { exclude: true }
  },
  response: { rows: '/results', concise: ['_id', 'status', 'createdAt', 'startedAt', 'finishedAt', 'processing'], detailed: true }
} satisfies AgentOperation

const describeRun = {
  name: 'describe_run',
  title: { en: 'Describe a run', fr: 'Décrire une exécution' },
  description: 'Read a run with its log: the steps, infos, warnings and errors the plugin wrote. The tool to explain why a run failed. The log may quote data of external sources.',
  annotations: { readOnlyHint: true }
} satisfies AgentOperation

const killRun = {
  name: 'kill_run',
  title: { en: 'Kill a run', fr: 'Arrêter une exécution' },
  description: 'Stop a running run: its status becomes kill until the worker stops it (killed). The work done by the plugin so far is not rolled back.',
  annotations: { destructiveHint: true, openWorldHint: false }
} satisfies AgentOperation

const deleteProcessing = {
  name: 'delete_processing',
  title: { en: 'Delete a processing', fr: 'Supprimer un traitement' },
  description: 'Delete a processing permanently, its runs are deleted too. The datasets it published stay.',
  annotations: { destructiveHint: true, openWorldHint: false }
} satisfies AgentOperation

export const operations = {
  listProcessings,
  getProcessing: describeProcessing,
  postProcessing: createProcessing,
  patchProcessing: [updateProcessing, updateProcessingPermissions],
  putProcessingConfig: processingConfig,
  triggerProcessing,
  listRuns,
  getRun: describeRun,
  killRun,
  deleteProcessing
} satisfies Partial<Record<ScopedOperationId, AgentOperationAnnotation>>

const toolNames = [listProcessings, describeProcessing, createProcessing, updateProcessing, updateProcessingPermissions, triggerProcessing, listRuns, describeRun, killRun, deleteProcessing].map(op => op.name)

export const root: AgentRoot = {
  skills: [{
    name: 'workflow',
    description: 'How to set up and follow processings: find a plugin, create a processing, fill its config, schedule and activate it, trigger it, then follow its runs and diagnose a failed one from its log. Read it before creating or repairing a processing.',
    // the body is skills/workflow.md, served next to this document
    href: 'agents/skills/workflow.md',
    tools: toolNames
  }]
}
