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
import { reqOrigin, session } from '@data-fair/lib-express/index.js'
import { ensureArtefact } from '@data-fair/lib-node-registry'
import { httpError } from '@data-fair/lib-utils/http-errors.js'
import { createNext } from '@data-fair/processings-shared/runs.ts'
import { parsePluginId } from '@data-fair/processings-shared/plugin-id.ts'
import { importPluginModule } from '@data-fair/processings-shared/plugin-load.ts'
import { applyProcessing, deleteProcessing } from '../runs/service.ts'
import { cipher, decipher } from '@data-fair/processings-shared/cipher.ts'
import mongo from '#mongo'
import config, { registryCacheDir } from '#config'
import locks from '#locks'
import { resolvedSchema as processingSchema } from '#types/processing/index.ts'
import getApiDoc from '../misc/utils/api-docs.ts'
import findUtils from '../misc/utils/find.ts'
import permissions from '../misc/utils/permissions.ts'

const router = Router()
export default router

// @ts-ignore
const ajv = ajvFormats(new Ajv({ strict: false }))

/**
 * Ensure the plugin tarball is in the API's local cache (downloads on miss).
 * Registry enforces that `processing.owner` has access to the artefact; a 403
 * here surfaces directly to the caller.
 *
 * The plugin's processing config schema is read from the conventional
 * `processing-config-schema.json` shipped alongside the plugin (same convention
 * as v5). Returns `undefined` when the plugin doesn't ship one.
 */
async function ensurePluginAndReadSchema (processing: Pick<Processing, 'pluginId' | 'owner'>) {
  const { name, major } = parsePluginId(processing.pluginId)
  const ensured = await ensureArtefact({
    registryUrl: config.privateRegistryUrl,
    secretKey: config.secretKeys.registry,
    artefactId: name,
    version: major,
    cacheDir: registryCacheDir,
    architecture: process.arch,
    account: {
      type: processing.owner.type,
      id: processing.owner.id,
      ...(processing.owner.department ? { department: processing.owner.department } : {})
    }
  })
  const schemaPath = path.join(ensured.path, 'processing-config-schema.json')
  let processingConfigSchema: Record<string, unknown> | undefined
  if (await fs.pathExists(schemaPath)) {
    processingConfigSchema = await fs.readJson(schemaPath)
  }
  return { ensured, processingConfigSchema }
}

const sensitiveParts = ['permissions', 'webhookKey', 'config']

/**
 * Helper function to send events related to processings
 * @param processing The processing object
 * @param actionText The text describing the action (e.g. "a été créé")
 * @param topicAction The action part of the topic key (e.g. "create", "delete")
 * @param sessionState Optional session state for authentication
 */
const sendProcessingEvent = (
  processing: Processing,
  actionText: string,
  topicAction: string,
  sessionState?: SessionStateAuthenticated
) => {
  if (!config.privateEventsUrl && !config.secretKeys.events) return

  eventsQueue.pushEvent({
    title: `Le traitement ${processing.title} ${actionText}`,
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
 * Errors from registry (404 unknown artefact, 403 owner has no access) bubble
 * up as the corresponding HTTP errors and replace the explicit access check
 * that used to live in the create/update endpoints.
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
  // Get the plugin file and execute the prepare function if it exists.
  const { ensured } = await ensurePluginAndReadSchema(processing)
  const plugin = await importPluginModule<{ prepare?: PrepareFunction }>(ensured.path, { cacheBust: true })
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
router.get('', async (req, res) => {
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
  // Filter by plugins (matches the denormalized pluginId, e.g. `@scope/foo@1`)
  const plugins = params.plugins ? params.plugins.split(',') : []
  if (plugins.length > 0) {
    queryWithFilters.pluginId = { $in: plugins }
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
              _id: '$pluginId',
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
              cond: { $ne: ['$$dept.department', null] } // Filtrer les départements null
            }
          }
        }
      }
    ]

    // Ajout des `owners` dans le résultat final
    aggregationPipeline[1].$replaceRoot.newRoot.owners = { $ifNull: ['$owners', []] }
  } else {
    aggregationPipeline.unshift({ $match: query })
  }

  const aggregationResult = await mongo.processings.aggregate(aggregationPipeline).toArray()
  const facets = aggregationResult[0] || { statuses: {}, plugins: {}, owners: [] }

  res.json({ results: results.map((p) => cleanProcessing(p as Processing, sessionState)), facets, count })
})

router.post('', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
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

  // Plugin access check is delegated to registry: validateFullProcessing
  // calls ensureArtefact with owner=body.owner, and registry returns 403 if
  // the artefact is private and the owner has no privateAccess entry.
  const processing = await validateFullProcessing(body)
  Object.assign(processing, await prepareProcessing(processing))
  await mongo.processings.insertOne(processing)

  sendProcessingEvent(processing, 'a été créé', 'create', sessionState)
  res.status(200).json(cleanProcessing(processing, sessionState))
})

// Patch some of the attributes of a processing
router.patch('/:id', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()

  // Restrict the parts of the processing that can be edited by API
  const acceptedParts = Object.keys(processingSchema.properties)
    .filter(k => sessionState.user.adminMode || !(processingSchema.properties)[k].readOnly || 'owner')
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported patch part ' + key)
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
  req.body.updated = {
    id: sessionState.user.id,
    name: sessionState.user.name,
    date: new Date().toISOString()
  }

  const patch: Record<string, any> = { $set: {} }
  for (const key in req.body) {
    if (req.body[key] === null) {
      patch.$unset = patch.$unset || {}
      patch.$unset[key] = true
      delete req.body[key]
    } else {
      patch.$set = patch.$set || {}
      patch.$set[key] = req.body[key]
    }
  }
  const patchedProcessing = await validateFullProcessing({ ...processing, ...req.body })
  const preparedProcessing = await prepareProcessing(patchedProcessing)
  Object.assign(patch.$set, preparedProcessing)
  Object.assign(patchedProcessing, preparedProcessing)

  await mongo.processings.updateOne({ _id: req.params.id }, patch)
  await mongo.runs.updateMany({ 'processing._id': processing._id }, { $set: { permissions: patchedProcessing.permissions || [] } })
  await applyProcessing(mongo, patchedProcessing)
  if (config.privateEventsUrl && config.secretKeys.events) {
    sendProcessingEvent(patchedProcessing, 'a été modifié', 'patch', sessionState)
  }
  res.status(200).json(cleanProcessing(patchedProcessing, sessionState))
})

// Get a processing
router.get('/:id', async (req, res) => {
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
router.get('/:id/plugin-config-schema', async (req, res, next) => {
  try {
    const sessionState = await session.reqAuthenticated(req)
    const processing = await mongo.processings.findOne({ _id: req.params.id })
    if (!processing) return res.status(404).send()
    if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) ?? '')) return res.status(403).send()
    const { processingConfigSchema } = await ensurePluginAndReadSchema(processing)
    if (!processingConfigSchema) return res.status(404).send()
    res.status(200).json(processingConfigSchema)
  } catch (err) { next(err) }
})

// Delete a processing
router.delete('/:id', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  await mongo.processings.deleteOne({ _id: req.params.id })
  if (processing) await deleteProcessing(mongo, processing)
  sendProcessingEvent(processing, 'a été supprimé', 'delete', sessionState)
  res.sendStatus(204)
})

router.get('/:id/webhook-key', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  res.send(processing.webhookKey)
})

router.delete('/:id/webhook-key', async (req, res) => {
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
    if (req.query.key !== processing.webhookKey) return res.status(403).send('Mauvaise clé de déclenchement')
    sendProcessingEvent(processing, 'a été déclenché par webhook', 'trigger')
  } else {
    const sessionState = await session.reqAuthenticated(req)
    if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) ?? '')) return res.status(403).send()
    sendProcessingEvent(processing, 'a été déclenché manuellement', 'trigger', sessionState)
  }
  if (!processing.active) return res.status(409).send('Le traitement n\'est pas actif')
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
