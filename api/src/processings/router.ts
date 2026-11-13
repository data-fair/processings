import type { Processing } from '#types'
import type { PrepareFunction } from '@data-fair/lib-common-types/processings.js'
import type { SessionStateAuthenticated } from '@data-fair/lib-express/index.js'

import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'
import cryptoRandomString from 'crypto-random-string'
import { Router } from 'express'
import fs from 'fs-extra'
import path from 'path'
import { nanoid } from 'nanoid'

import eventsQueue from '@data-fair/lib-node/events-queue.js'
import { assertReqScope, reqOrigin, session } from '@data-fair/lib-express/index.js'
import { ensureArtefact } from '@data-fair/lib-node-registry'
import { httpError } from '@data-fair/lib-utils/http-errors.js'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { privateHttpAgent, privateHttpsAgent } from '@data-fair/lib-node/http-agents.js'
import { createNext } from '@data-fair/processings-shared/runs.ts'
import { importPluginModule } from '@data-fair/processings-shared/plugin-load.ts'
import { applyProcessing, deleteProcessing } from '../runs/service.ts'
import { cipher, decipher } from '@data-fair/processings-shared/cipher.ts'
import mongo from '#mongo'
import config, { registryCacheDir } from '#config'
import locks from '#locks'
import getApiDoc from '../misc/utils/api-docs.ts'
import findUtils from '../misc/utils/find.ts'
import permissions from '../misc/utils/permissions.ts'
import { translateRegistryError } from './operations.ts'
import { acceptedScopes, requireOperationScope } from '../scopes.ts'
import { creatableFields, patchableFields, processingPatchFields } from './patch-fields.ts'
import { agentConfigSchema } from './agent-config-schema.ts'

const router = Router()
export default router

// addUsedSchema: false keeps compile() from registering schemas in the
// instance, so two plugin majors that share a $id can both validate.
// @ts-ignore
const ajv = ajvFormats(new Ajv({ strict: false, addUsedSchema: false }))

/**
 * Ensure the plugin tarball is in the API's local cache (downloads on miss).
 * Registry enforces that `processing.owner` has access to the artefact; a 403
 * here surfaces directly to the caller as a user-facing French message.
 *
 * The plugin's processing config schema is read from the conventional
 * `processing-config-schema.json` shipped alongside the plugin (v6 convention),
 * falling back to `plugin.json#processingConfigSchema` for legacy v5 plugins
 * whose tarballs were packed verbatim by the registry migration and never had
 * the schema extracted into a standalone file. Returns `undefined` when
 * neither source carries one.
 */
/**
 * The registry evaluates artefact access against an `x-account` header. For a
 * processing that is always the OWNER — anyone allowed to see the processing
 * inherits the owner's plugin access transitively.
 */
const registryAccount = (owner: Processing['owner']) => ({
  type: owner.type,
  id: owner.id,
  ...(owner.department ? { department: owner.department } : {})
})

async function ensurePluginAndReadSchema (processing: Pick<Processing, 'plugin' | 'owner'>) {
  const account = registryAccount(processing.owner)
  // `processing.plugin` is the registry artefact id, passed through as-is.
  // lib-node downloads + extracts the tarball into registryCacheDir on cache
  // miss; the cache is invalidated when the artefact's dataUpdatedAt bumps.
  let ensured
  try {
    ensured = await ensureArtefact({
      registryUrl: config.privateRegistryUrl,
      secretKey: config.secretKeys.registry,
      artefactId: processing.plugin,
      cacheDir: registryCacheDir,
      account
    })
  } catch (err: any) {
    throw translateRegistryError(err, processing)
  }
  const schemaPath = path.join(ensured.path, 'processing-config-schema.json')
  let processingConfigSchema: Record<string, unknown> | undefined
  if (await fs.pathExists(schemaPath)) {
    processingConfigSchema = await fs.readJson(schemaPath)
  } else {
    const pluginJsonPath = path.join(ensured.path, 'plugin.json')
    if (await fs.pathExists(pluginJsonPath)) {
      const pluginJson = await fs.readJson(pluginJsonPath)
      if (pluginJson?.processingConfigSchema) processingConfigSchema = pluginJson.processingConfigSchema
    }
  }
  return { ensured, processingConfigSchema }
}

/**
 * Fetch plugin artefact METADATA (title, description, thumbnail ref, ...) from
 * the registry on behalf of the processing's owner. Lightweight — unlike
 * `ensureArtefact` it does not download the tarball. Used by the `/:id/plugin`
 * endpoint so individually-permitted viewers don't need their own plugin grant.
 */
async function fetchPluginArtefact (processing: Pick<Processing, 'plugin' | 'owner'>) {
  const ax = axiosBuilder({
    baseURL: config.privateRegistryUrl,
    // the registry is a service of our own infrastructure
    httpAgent: privateHttpAgent,
    httpsAgent: privateHttpsAgent,
    headers: {
      'x-secret-key': config.secretKeys.registry,
      'x-account': JSON.stringify(registryAccount(processing.owner))
    }
  })
  try {
    const res = await ax.get(`/api/v1/artefacts/${encodeURIComponent(processing.plugin)}`)
    return res.data
  } catch (err) {
    throw translateRegistryError(err, processing)
  }
}

const sensitiveParts = ['permissions', 'webhookKey', 'config']

const processingTitles = {
  create: (title: string) => ({ en: `The processing ${title} was created`, fr: `Le traitement ${title} a été créé` }),
  patch: (title: string) => ({ en: `The processing ${title} was updated`, fr: `Le traitement ${title} a été modifié` }),
  delete: (title: string) => ({ en: `The processing ${title} was deleted`, fr: `Le traitement ${title} a été supprimé` }),
  trigger: (title: string) => ({ en: `The processing ${title} was triggered manually`, fr: `Le traitement ${title} a été déclenché manuellement` }),
  'trigger-webhook': (title: string) => ({ en: `The processing ${title} was triggered by a webhook`, fr: `Le traitement ${title} a été déclenché par webhook` })
}

/**
 * Send an event about a processing.
 * @param topicAction The action part of the topic key
 * @param textAction The text of the title, when it is more precise than the topic action
 */
const sendProcessingEvent = (
  processing: Processing,
  topicAction: 'create' | 'patch' | 'delete' | 'trigger',
  sessionState?: SessionStateAuthenticated,
  textAction: keyof typeof processingTitles = topicAction
) => {
  eventsQueue.pushEvent({
    title: processingTitles[textAction](processing.title),
    topic: { key: `processings:processing-${topicAction}:${processing._id}` },
    sender: processing.owner,
    resource: {
      type: 'processing',
      id: processing._id,
      title: processing.title,
    }
  }, sessionState)
}

/**
 * Check that a processing object is valid:
 * - run schema validation
 * - require a config when active
 * - validate the config against the plugin's processingConfigSchema (read
 *   from the cached package.json#registry block, downloaded on cache miss)
 *
 * Skipped entirely when the processing has no config. Registry errors are
 * translated to user-facing French messages inside ensurePluginAndReadSchema.
 */
async function validateFullProcessing (processing: any): Promise<Processing> {
  (await import('#types/processing/index.ts')).returnValid(processing)
  if (processing.active && !processing.config) throw httpError(400, 'Config is required for an active processing')
  if (!processing.config) return processing // no config to validate
  const { processingConfigSchema } = await ensurePluginAndReadSchema(processing)
  if (!processingConfigSchema) throw httpError(400, 'plugin has no processingConfigSchema')
  const configValidate = ajv.compile(processingConfigSchema)
  const configValid = configValidate(processing.config)
  if (!configValid) throw httpError(400, JSON.stringify(configValidate.errors))
  return processing
}

const prepareProcessing = async (processing: Processing) => {
  // `prepare` operates on the user-supplied config (e.g. exchanging OAuth
  // refresh tokens for ciphered secrets). With no config there's nothing to
  // prepare — and skipping the registry fetch lets a processing be created
  // even when the owner has no access to the plugin yet. The same broken
  // state is what the UI banner already shows for deleted plugins.
  if (!processing.config) return
  const { ensured } = await ensurePluginAndReadSchema(processing)
  const plugin = await importPluginModule<{ prepare?: PrepareFunction }>(ensured.path)
  if (!(plugin.prepare && typeof plugin.prepare === 'function')) return

  // Decipher the actuals secrets if they are present
  const currentSecrets: Record<string, string> = {}
  if (processing.secrets) {
    Object.keys(processing.secrets).forEach(key => {
      currentSecrets[key] = decipher(processing.secrets![key], config.cipherPassword)
    })
  }

  // Call the prepare function
  const res: { config?: Processing['config'], secrets?: Processing['secrets'] } = {}
  const prepareRes = await (plugin.prepare as PrepareFunction)({ processingConfig: processing.config ?? {}, secrets: currentSecrets })
  if (prepareRes.processingConfig) res.config = prepareRes.processingConfig
  if (prepareRes.secrets) {
    res.secrets = {}
    for (const key of Object.keys(prepareRes.secrets)) {
      res.secrets[key] = cipher(prepareRes.secrets[key], config.cipherPassword)
    }
  }
  return res
}

/**
 * Remove sensitive parts from a processing object (permissions, webhookKey and config)
 * @param processing the processing object to clean
 * @param sessionState the session state
 * @param host the req.headers.host
 * @returns the cleaned processing object
 */
const cleanProcessing = (processing: Processing, sessionState: SessionStateAuthenticated) => {
  delete processing.webhookKey
  delete processing.secrets
  processing.userProfile = permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState)
  if (processing.userProfile !== 'admin') {
    for (const part of sensitiveParts) delete (processing as any)[part]
  }
  return processing
}

// Get the list of processings
router.get('', requireOperationScope('listProcessings'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const params = (await import('#doc/processings/get-req/index.ts')).returnValid(req.query)
  const sort = findUtils.sort(params.sort)
  const [size, skip] = findUtils.pagination(params.size, params.page, params.skip)
  const project = findUtils.project(params.select)
  const query = findUtils.query(params, sessionState) // Check permissions

  const queryWithFilters = { ...query }
  // Filter by statuses
  const statuses = params.statuses ? params.statuses.split(',') : []
  if (statuses.length > 0) {
    queryWithFilters.$and = queryWithFilters.$and || []
    queryWithFilters.$and.push({
      $or: [
        statuses.includes('none') ? { lastRun: { $exists: false } } : null,
        statuses.includes('scheduled') ? { nextRun: { $exists: true } } : null,
        { 'lastRun.status': { $in: statuses } }
      ].filter(Boolean)
    })
  }
  // Filter by plugins (matches the registry artefact id stored on `plugin`)
  const plugins = params.plugins ? params.plugins.split(',') : []
  if (plugins.length > 0) {
    queryWithFilters.plugin = { $in: plugins }
  }

  // Get the processings
  const [results, count] = await Promise.all([
    size > 0 ? mongo.processings.find(queryWithFilters).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    mongo.processings.countDocuments(query)
  ])

  const aggregationPipeline = [
    {
      $facet: {
        scheduled: [
          {
            $match: { nextRun: { $exists: true } }
          },
          {
            $group: {
              _id: 'scheduled',
              count: { $sum: 1 }
            }
          }
        ],
        otherStatuses: [
          {
            $group: {
              _id: {
                $cond: [
                  { $eq: [{ $ifNull: ['$lastRun', 'none'] }, 'none'] },
                  'none',
                  '$lastRun.status'
                ]
              },
              count: { $sum: 1 }
            }
          }
        ],
        plugins: [
          {
            $group: {
              _id: '$plugin',
              count: { $sum: 1 }
            }
          }
        ]
      }
    },
    {
      $replaceRoot: {
        newRoot: {
          statuses: {
            $mergeObjects: [
              { scheduled: { $ifNull: [{ $arrayElemAt: ['$scheduled.count', 0] }, 0] } },
              { $arrayToObject: { $map: { input: '$otherStatuses', as: 'el', in: { k: '$$el._id', v: '$$el.count' } } } }
            ]
          },
          plugins: { $arrayToObject: { $map: { input: '$plugins', as: 'el', in: { k: '$$el._id', v: '$$el.count' } } } }
        }
      }
    }
  ] as any[]

  // Get for each owner (user/organization OR department) the number of processings
  if (params.showAll === 'true') {
    aggregationPipeline[0].$facet.owners = [
      {
        $group: {
          _id: {
            type: '$owner.type',
            id: '$owner.id',
            name: '$owner.name',
            department: { $ifNull: ['$owner.department', null] },
            departmentName: { $ifNull: ['$owner.departmentName', null] }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          count: 1,
          value: {
            type: '$_id.type',
            id: '$_id.id',
            name: '$_id.name',
            department: '$_id.department',
            departmentName: '$_id.departmentName'
          }
        }
      },
      {
        $group: {
          _id: {
            type: '$value.type',
            id: '$value.id',
            name: '$value.name'
          },
          totalCount: { $sum: '$count' },
          departments: {
            $push: {
              department: '$value.department',
              departmentName: '$value.departmentName',
              count: '$count'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id.type',
          id: '$_id.id',
          name: '$_id.name',
          totalCount: 1,
          departments: {
            $filter: {
              input: '$departments',
              as: 'dept',
              cond: { $ne: ['$$dept.department', null] } // filter out null departments
            }
          }
        }
      }
    ]

    // add the `owners` to the final result
    aggregationPipeline[1].$replaceRoot.newRoot.owners = { $ifNull: ['$owners', []] }
  } else {
    aggregationPipeline.unshift({ $match: query })
  }

  const aggregationResult = await mongo.processings.aggregate(aggregationPipeline).toArray()
  const facets = aggregationResult[0] || { statuses: {}, plugins: {}, owners: [] }

  res.json({ results: results.map((p) => cleanProcessing(p as Processing, sessionState)), facets, count })
})

router.post('', requireOperationScope('postProcessing'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const acceptedParts = creatableFields(!!sessionState.user.adminMode)
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported part ' + key)
  }
  if (Object.keys(req.body).some(key => key !== 'owner' && (processingPatchFields.admin as readonly string[]).includes(key))) {
    // choosing the owner of a new processing is part of creating it, opening it to others is not
    assertReqScope(req, acceptedScopes('processings', 'admin'))
  }
  const body = { ...req.body }
  body._id = nanoid()
  body.owner = body.owner ?? sessionState.account
  if (!permissions.isAdmin(sessionState, body.owner)) return res.status(403).send('No permission to create a processing')
  body.scheduling = body.scheduling || []
  body.webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  body.created = body.updated = {
    id: sessionState.user.id,
    name: sessionState.user.name,
    date: new Date().toISOString()
  }

  // Plugin access is only checked when actually needed: validateFullProcessing
  // and prepareProcessing both short-circuit when `body.config` is absent. A
  // processing created without config lands in the same "plugin not loaded"
  // state that existed for deleted/revoked plugins — see ui pluginBroken.
  const processing = await validateFullProcessing(body)
  Object.assign(processing, await prepareProcessing(processing))
  await mongo.processings.insertOne(processing)

  sendProcessingEvent(processing, 'create', sessionState)
  res.status(200).json(cleanProcessing(processing, sessionState))
})

// Save a validated patch of a processing (null values unset their part): validation against the
// plugin schema, prepare, runs permissions, scheduling and event. Shared by PATCH and PUT config.
const saveProcessingPatch = async (processing: Processing, body: Record<string, any>, sessionState: SessionStateAuthenticated) => {
  body = { ...body }
  body.updated = {
    id: sessionState.user.id,
    name: sessionState.user.name,
    date: new Date().toISOString()
  }

  const patch: Record<string, any> = { $set: {} }
  for (const key in body) {
    if (body[key] === null) {
      patch.$unset = patch.$unset || {}
      patch.$unset[key] = true
      delete body[key]
    } else {
      patch.$set = patch.$set || {}
      patch.$set[key] = body[key]
    }
  }
  const patchedProcessing = await validateFullProcessing({ ...processing, ...body })
  const preparedProcessing = await prepareProcessing(patchedProcessing)
  Object.assign(patch.$set, preparedProcessing)
  Object.assign(patchedProcessing, preparedProcessing)

  await mongo.processings.updateOne({ _id: processing._id }, patch)
  await mongo.runs.updateMany({ 'processing._id': processing._id }, { $set: { permissions: patchedProcessing.permissions || [] } })
  await applyProcessing(mongo, patchedProcessing)
  sendProcessingEvent(patchedProcessing, 'patch', sessionState)
  return patchedProcessing
}

// Patch some of the attributes of a processing
router.patch('/:id', requireOperationScope('patchProcessing'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()

  // Restrict the parts of the processing that can be edited by API
  const acceptedParts = patchableFields(!!sessionState.user.adminMode)
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported patch part ' + key)
  }
  if (Object.keys(req.body).some(key => (processingPatchFields.admin as readonly string[]).includes(key))) {
    assertReqScope(req, acceptedScopes('processings', 'admin'))
  }
  for (const key in req.body) {
    if (key === 'owner') {
      // check if the user has the right to change to this owner
      const isAdmin =
        (req.body.owner.type === 'user' && sessionState.user.id === req.body.owner.id) ||
        sessionState.user.organizations.some(o =>
          o.id === req.body.owner.id && (!o.department || o.department === req.body.owner.department) && o.role === 'admin'
        )

      if (!isAdmin) {
        return res.status(403).send('No permission to change the owner to ' + req.body.owner)
      }
      // If the owner is changed, also change it in all runs of this processing
      await mongo.runs.updateMany({ 'processing._id': processing._id }, { $set: { owner: req.body.owner } })
    }
  }
  const patchedProcessing = await saveProcessingPatch(processing, req.body, sessionState)
  res.status(200).json(cleanProcessing(patchedProcessing, sessionState))
})

// Read the config of a processing (a sensitive part, admin profile only)
router.get('/:id/config', requireOperationScope('getProcessingConfig'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  res.json(processing.config ?? {})
})

// Replace the whole config of a processing, as a PATCH of its config part
router.put('/:id/config', requireOperationScope('putProcessingConfig'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).send('The config must be an object')
  const patchedProcessing = await saveProcessingPatch(processing, { config: req.body }, sessionState)
  res.status(200).json(patchedProcessing.config ?? {})
})

// Get a processing
router.get('/:id', requireOperationScope('getProcessing'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) ?? '')) return res.status(403).send()
  res.status(200).json(cleanProcessing(processing, sessionState))
})

// Get the plugin's processingConfigSchema for this processing's pinned major.
// Registry only stores tarballs and ignores their inner shape; the schema
// ships as `processing-config-schema.json` next to the plugin and is read
// on demand from the API's local cache.
router.get('/:id/plugin-config-schema', requireOperationScope('getPluginConfigSchema'), async (req, res, next) => {
  try {
    const sessionState = await session.reqAuthenticated(req)
    const processing = await mongo.processings.findOne({ _id: req.params.id })
    if (!processing) return res.status(404).send()
    if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) ?? '')) return res.status(403).send()
    const { processingConfigSchema } = await ensurePluginAndReadSchema(processing)
    if (!processingConfigSchema) {
      return res.status(404).type('text/plain').send(
        `Plugin "${processing.plugin}" ships no processing config schema (no processing-config-schema.json in tarball and no processingConfigSchema field in plugin.json).`
      )
    }
    // agent=true: the schema as the agent config editor consumes it (v3 syntax, context resolved)
    res.status(200).json(req.query.agent === 'true' ? agentConfigSchema(processingConfigSchema, processing) : processingConfigSchema)
  } catch (err) { next(err) }
})

// Get the plugin's registry metadata for this processing. Permission is checked
// against the requesting user; the registry fetch runs as the owner so a viewer
// with only an individual permission inherits the owner's plugin access.
router.get('/:id/plugin', requireOperationScope('getProcessingPlugin'), async (req, res, next) => {
  try {
    const sessionState = await session.reqAuthenticated(req)
    const processing = await mongo.processings.findOne({ _id: req.params.id })
    if (!processing) return res.status(404).send()
    if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) ?? '')) return res.status(403).send()
    const artefact = await fetchPluginArtefact(processing)
    res.status(200).json(artefact)
  } catch (err) { next(err) }
})

// Delete a processing
router.delete('/:id', requireOperationScope('deleteProcessing'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  await mongo.processings.deleteOne({ _id: req.params.id })
  if (processing) await deleteProcessing(mongo, processing)
  sendProcessingEvent(processing, 'delete', sessionState)
  res.sendStatus(204)
})

router.get('/:id/webhook-key', requireOperationScope('getProcessingWebhookKey'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  res.send(processing.webhookKey)
})

router.delete('/:id/webhook-key', requireOperationScope('deleteProcessingWebhookKey'), async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  const webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  await mongo.processings.updateOne(
    { _id: processing._id },
    { $set: { webhookKey } }
  )
  res.send(webhookKey)
})

router.post('/:id/_trigger', async (req, res) => {
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (req.query.key) {
    if (req.query.key !== processing.webhookKey) return res.status(403).send('Wrong trigger key')
    sendProcessingEvent(processing, 'trigger', undefined, 'trigger-webhook')
  } else {
    // the webhook key path reads no session, so the scope is checked here rather than by a middleware
    assertReqScope(req, acceptedScopes('processings', 'write'))
    const sessionState = await session.reqAuthenticated(req)
    if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) ?? '')) return res.status(403).send()
    sendProcessingEvent(processing, 'trigger', sessionState)
  }
  if (!processing.active) return res.status(409).send('The processing is not active')
  res.send(await createNext(mongo.db, locks, processing, true, req.query.delay ? Number(req.query.delay) : 0))
})

// Get the API documentation of a processing
router.get('/:id/api-docs.json', permissions.isSuperAdmin, async (req, res, next) => {
  try {
    const processing = await mongo.processings.findOne({ _id: req.params.id })
    if (!processing) return res.status(404).send()
    const { ensured, processingConfigSchema } = await ensurePluginAndReadSchema(processing)
    const pluginPkg = await fs.readJson(path.join(ensured.path, 'package.json'))
    const plugin = {
      name: pluginPkg.name,
      version: pluginPkg.version,
      processingConfigSchema
    }
    res.json(getApiDoc(reqOrigin(req), { processing, plugin }))
  } catch (err) { next(err) }
})
