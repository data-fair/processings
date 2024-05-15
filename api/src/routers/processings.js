import { createNext } from '../../../shared/runs.js'
import { applyProcessing, deleteProcessing } from '../utils/runs.js'
import { session, asyncHandler } from '@data-fair/lib/express/index.js'
import { Router } from 'express'
import { nanoid } from 'nanoid'
import processingSchema from '../../../contract/processing.js'
import config from '../config.js'
import findUtils from '../utils/find.js'
import permissions from '../utils/permissions.js'
import mongo from '@data-fair/lib/node/mongo.js'
import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'
import cryptoRandomString from 'crypto-random-string'
import fs from 'fs-extra'
import createError from 'http-errors'
import path from 'path'
import resolvePath from 'resolve-path'

const router = Router()
export default router

// @ts-ignore
const ajv = ajvFormats(new Ajv({ strict: false }))
const pluginsDir = path.join(config.dataDir, 'plugins')

const sensitiveParts = ['permissions', 'webhookKey', 'config']

/** @typedef {import('../../../shared/types/processing/index.js').Processing} Processing */

/**
 * Check that a processing object is valid
 * Check if the plugin exists
 * Check if the config is valid (only if the processing is activated)
 * @param {Processing} processing
 * @returns {Promise<void>}
 */
const validateFullProcessing = async (processing) => {
  // config is required only after the processing was activated
  const schema = processing.active
    ? { ...processingSchema, required: [...processingSchema.required, 'config'] }
    : processingSchema
  const validate = ajv.compile(schema)
  const valid = validate(processing)
  if (!valid) throw createError(400, JSON.stringify(validate.errors))
  if (!await fs.pathExists(path.join(pluginsDir, processing.plugin))) throw createError(400, 'Plugin not found')
  if (!processing.config) return // no config to validate
  const pluginInfo = await fs.readJson(path.join(pluginsDir, path.join(processing.plugin, 'plugin.json')))
  const configValidate = ajv.compile(pluginInfo.processingConfigSchema)
  const configValid = configValidate(processing.config)
  if (!configValid) throw createError(400, JSON.stringify(configValidate.errors))
}

/**
 * Remove sensitive parts from a processing object (permissions, webhookKey and config)
 * @param {Processing} processing the processing object to clean
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState the session state
 * @param {string|undefined} host the req.headers.host
 * @returns {Processing} the cleaned processing object
 */
const cleanProcessing = (processing, sessionState, host) => {
  delete processing.webhookKey
  processing.userProfile = permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState, host)
  if (processing.userProfile !== 'admin') {
    // @ts-ignore
    for (const part of sensitiveParts) delete processing[part]
  }
  return processing
}

/**
 * @typedef {object} getParams
 * @property {string} size
 * @property {string} page
 * @property {string} skip
 * @property {string} showAll
 * @property {string} sort
 * @property {string} select
 * @property {string} q
 * @property {string} statuses
 * @property {string} plugins
 */

// Get the list of processings
router.get('', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  /** @type {import('mongodb').Collection<Processing>} */
  const processingsCollection = mongo.db.collection('processings')
  const params = /** @type {getParams} */(req.query)
  const sort = findUtils.sort(params.sort)
  const [size, skip] = findUtils.pagination(params.size, params.page, params.skip)
  const project = findUtils.project(params.select)
  const query = findUtils.query(params, sessionState) // Check permissions

  const queryWithFilters = { ...query }
  // Filter by statuses
  const statuses = params.statuses ? params.statuses.split(',') : []
  if (statuses.length > 0) {
    queryWithFilters.$or = [
      statuses.includes('none') ? { lastRun: { $exists: false } } : null,
      statuses.includes('scheduled') ? { nextRun: { $exists: true } } : null,
      { 'lastRun.status': { $in: statuses } }
    ].filter(Boolean)
  }
  // Filter by plugins
  const plugins = params.plugins ? params.plugins.split(',') : []
  if (plugins.length > 0) {
    queryWithFilters.plugin = { $in: plugins }
  }

  // Get the processings
  const [results, count] = await Promise.all([
    size > 0 ? processingsCollection.find(queryWithFilters).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    processingsCollection.countDocuments(query)
  ])

  const aggregationResult = await processingsCollection.aggregate([
    { $match: query },
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
              { scheduled: { $arrayElemAt: ['$scheduled.count', 0] || 0 } },
              { $arrayToObject: { $map: { input: '$otherStatuses', as: 'el', in: { k: '$$el._id', v: '$$el.count' } } } }
            ]
          },
          plugins: { $arrayToObject: { $map: { input: '$plugins', as: 'el', in: { k: '$$el._id', v: '$$el.count' } } } }
        }
      }
    }
  ]).toArray()

  const facets = aggregationResult[0] || { statuses: {}, plugins: {} }

  // @ts-ignore -> p is a processing
  res.json({ results: results.map((p) => cleanProcessing(p, sessionState, req.headers.host)), facets, count })
}))

/**
 * Create a processing
 * @param {import('express').Request} req
 * req.body { plugin: string, title: string, ...optionals scheduling: object}
 * @param {import('express').Response} res 403 if the user is not an admin
 */
router.post('', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = { ...req.body }
  processing._id = nanoid()
  processing.owner = sessionState.account
  if (!permissions.isAdmin(sessionState, processing.owner)) return res.status(403).send()
  processing.scheduling = processing.scheduling || { type: 'trigger' }
  processing.webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  processing.created = processing.updated = {
    id: sessionState.user.id,
    name: sessionState.user.name,
    date: new Date().toISOString()
  }

  const access = await fs.pathExists(resolvePath(pluginsDir, processing.plugin + '-access.json')) ? await fs.readJson(resolvePath(pluginsDir, processing.plugin + '-access.json')) : { public: false, privateAccess: [] }
  if (sessionState.user.adminMode) {
    // ok for super admins
  } else if (access && access.public) {
    // ok, this plugin is public
  } else if (access && access.privateAccess && access.privateAccess.find((/** @type {any} */ p) => p.type === processing.owner.type && p.id === processing.owner.id)) {
    // ok, private access is granted
  } else {
    return res.status(403).send()
  }

  await validateFullProcessing(processing)
  /** @type {import('mongodb').Collection<Processing>} */
  const processingsCollection = mongo.db.collection('processings')
  await processingsCollection.insertOne(processing)
  res.status(200).json(cleanProcessing(processing, sessionState, req.headers.host))
}))

// Patch some of the attributes of a processing
router.patch('/:id', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  /** @type {import('mongodb').Collection<Processing>} */
  const processingsCollection = mongo.db.collection('processings')
  const processing = await processingsCollection.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState, req.headers.host) !== 'admin') return res.status(403).send()

  // Restrict the parts of the processing that can be edited by API
  const acceptedParts = Object.keys(processingSchema.properties)
    // @ts-ignore
    .filter(k => sessionState.user.adminMode || !processingSchema.properties[k].readOnly)
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported patch part ' + key)
  }
  req.body.updated = {
    id: sessionState.user.id,
    name: sessionState.user.name,
    date: new Date().toISOString()
  }
  /** @type {any} */
  const patch = {}
  for (const key in req.body) {
    if (req.body[key] === null) {
      patch.$unset = patch.$unset || {}
      patch.$unset[key] = ''
      delete req.body[key]
    } else {
      patch.$set = patch.$set || {}
      patch.$set[key] = req.body[key]
    }
  }
  const patchedProcessing = { ...processing, ...req.body }
  await validateFullProcessing(patchedProcessing)
  await processingsCollection.updateOne({ _id: req.params.id }, patch)
  await mongo.db.collection('runs').updateMany({ 'processing._id': processing._id }, { $set: { permissions: patchedProcessing.permissions || [] } })
  await applyProcessing(mongo.db, patchedProcessing)
  res.status(200).json(cleanProcessing(patchedProcessing, sessionState, req.headers.host))
}))

// Get a processing
router.get('/:id', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  /** @type {import('mongodb').Collection<Processing>} */
  const processingsCollection = mongo.db.collection('processings')
  const processing = await processingsCollection.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState, req.headers.host) ?? '')) return res.status(403).send()
  res.status(200).json(cleanProcessing(processing, sessionState, req.headers.host))
}))

// Delete a processing
router.delete('/:id', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  /** @type {import('mongodb').Collection<Processing>} */
  const processingsCollection = mongo.db.collection('processings')
  const processing = await processingsCollection.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState, req.headers.host) !== 'admin') return res.status(403).send()
  await processingsCollection.deleteOne({ _id: req.params.id })
  if (processing) await deleteProcessing(mongo.db, processing)
  res.sendStatus(204)
}))

router.get('/:id/webhook-key', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  /** @type {import('mongodb').Collection<Processing>} */
  const processingsCollection = mongo.db.collection('processings')
  const processing = await processingsCollection.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState, req.headers.host) !== 'admin') return res.status(403).send()
  res.send(processing.webhookKey)
}))

router.delete('/:id/webhook-key', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  /** @type {import('mongodb').Collection<Processing>} */
  const processingsCollection = mongo.db.collection('processings')
  const processing = await processingsCollection.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState, req.headers.host) !== 'admin') return res.status(403).send()
  const webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  await processingsCollection.updateOne(
    { _id: processing._id },
    { $set: { webhookKey } }
  )
  res.send(webhookKey)
}))

router.post('/:id/_trigger', asyncHandler(async (req, res) => {
  /** @type {import('mongodb').Collection<Processing>} */
  const processingsCollection = mongo.db.collection('processings')
  const processing = await processingsCollection.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (req.query.key && req.query.key !== processing.webhookKey) {
    return res.status(403).send('Mauvaise clé de déclenchement')
  } else {
    const sessionState = await session.reqAuthenticated(req)
    if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState, req.headers.host) ?? '')) return res.status(403).send()
  }
  if (!processing.active) return res.status(409).send('Le traitement n\'est pas actif')
  res.send(await createNext(mongo.db, processing, true, req.query.delay ? Number(req.query.delay) : 0))
}))
