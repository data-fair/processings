import { createNext, applyProcessing, deleteProcessing } from '../utils/runs.js'
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

// @ts-ignore
const ajv = ajvFormats(new Ajv({ strict: false }))
const pluginsDir = path.join(config.dataDir, 'plugins')

const sensitiveParts = ['permissions', 'webhookKey', 'config']

const router = Router()
export default router

/**
 * Check that a processing object is valid
 * Check if the plugin exists
 * Check if the config is valid (only if the processing is activated)
 * @param {import('../../../shared/types/processing/index.js').Processing} processing
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
 * @param {import('../../../shared/types/processing/index.js').Processing} processing the processing object to clean
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @returns {import('../../../shared/types/processing/index.js').Processing} the cleaned processing object
 */
const cleanProcessing = (processing, reqSession) => {
  delete processing.webhookKey
  processing.userProfile = permissions.getUserResourceProfile(processing.owner, processing.permissions ?? [], reqSession)
  if (processing.userProfile !== 'admin') {
    // @ts-ignore
    for (const part of sensitiveParts) delete processing[part]
  }
  return processing
}

/**
 * @typedef {Object} getParams
 * @property {string} size
 * @property {string} page
 * @property {string} skip
 * @property {string} showAll
 * @property {string} sort
 * @property {string} select
 */

// Get the list of processings
router.get('', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  /** @type {getParams} */
  // @ts-ignore -> req.query is a getParams type
  const params = req.query
  const sort = findUtils.sort(params.sort)
  const [size, skip] = findUtils.pagination(params.size, params.page, params.skip)
  const project = findUtils.project(params.select)
  const query = findUtils.query(params, reqSession) // Check permissions
  const processings = mongo.db.collection('processings')
  const [results, count] = await Promise.all([
    size > 0 ? processings.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    processings.countDocuments(query)
  ])
  // @ts-ignore -> p is a processing
  res.json({ results: results.map((p) => cleanProcessing(p, reqSession)), count })
}))

// Create a processing
router.post('', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  const processing = { ...req.body }
  processing._id = nanoid()
  if (processing.owner && !reqSession.user.adminMode) return res.status(403).send('owner can only be set for superadmin')
  processing.owner = processing.owner || reqSession.account
  if (!permissions.isAdmin(reqSession, processing.owner)) return res.status(403).send()
  processing.scheduling = processing.scheduling || { type: 'trigger' }
  processing.webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  processing.created = processing.updated = {
    id: reqSession.user.id,
    name: reqSession.user.name,
    date: new Date().toISOString()
  }

  const access = await fs.pathExists(resolvePath(pluginsDir, processing.plugin + '-access.json')) ? await fs.readJson(resolvePath(pluginsDir, processing.plugin + '-access.json')) : { public: false, privateAccess: [] }
  if (reqSession.user.adminMode) {
    // ok for super admins
  } else if (access && access.public) {
    // ok, this plugin is public
  } else if (access && access.privateAccess && access.privateAccess.find((/** @type {any} */ p) => p.type === processing.owner.type && p.id === processing.owner.id)) {
    // ok, private access is granted
  } else {
    return res.status(403).send()
  }

  await validateFullProcessing(processing)
  await mongo.db.collection('processings').insertOne(processing)
  res.status(200).json(cleanProcessing(processing, reqSession))
}))

// Patch some of the attributes of a processing
router.patch('/:id', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  /** @type {import('../../../shared/types/processing/index.js').Processing} */
  // @ts-ignore -> req.body is a Processing type && req.params.id is an id
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions ?? [], reqSession) !== 'admin') return res.status(403).send()

  // Restrict the parts of the processing that can be edited by API
  const acceptedParts = Object.keys(processingSchema.properties)
    .filter(k => reqSession.user.adminMode || !processingSchema.properties[k].readOnly)
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported patch part ' + key)
  }
  req.body.updated = {
    id: reqSession.user.id,
    name: reqSession.user.name,
    date: new Date().toISOString()
  }
  /** @type {any} */
  const patch = {}
  for (const key in req.body) {
    if (!req.body[key]) {
      patch.$unset = patch.$unset || {}
      patch.$unset[key] = undefined
      req.body[key] = undefined
    } else {
      patch.$set = patch.$set || {}
      patch.$set[key] = req.body[key]
    }
  }
  const patchedProcessing = { ...processing, ...req.body }
  await validateFullProcessing(patchedProcessing)
  // @ts-ignore -> _id is an id
  await mongo.db.collection('processings').updateOne({ _id: req.params.id }, patch)
  await mongo.db.collection('runs').updateMany({ 'processing._id': processing._id }, { $set: { permissions: patchedProcessing.permissions || [] } })
  await applyProcessing(mongo.db, patchedProcessing)
  res.status(200).json(cleanProcessing(patchedProcessing, reqSession))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  /** @type {import('../../../shared/types/processing/index.js').Processing} */
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions ?? [], reqSession) ?? '')) return res.status(403).send()
  res.status(200).json(cleanProcessing(processing, reqSession))
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  /** @type {import('../../../shared/types/processing/index.js').Processing} */
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions ?? [], reqSession) !== 'admin') return res.status(403).send()
  await mongo.db.collection('processings').deleteOne({ _id: req.params.id })
  if (processing && processing.value) await deleteProcessing(mongo.db, processing)
  res.sendStatus(204)
}))

router.get('/:id/webhook-key', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  /** @type {import('../../../shared/types/processing/index.js').Processing} */
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions ?? [], reqSession) !== 'admin') return res.status(403).send()
  res.send(processing.webhookKey)
}))

router.delete('/:id/webhook-key', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  /** @type {import('../../../shared/types/processing/index.js').Processing} */
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions ?? [], reqSession) !== 'admin') return res.status(403).send()
  const webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  await mongo.db.collection('processings').updateOne(
    { _id: processing._id },
    { $set: { webhookKey } }
  )
  res.send(webhookKey)
}))

router.post('/:id/_trigger', asyncHandler(async (req, res) => {
  /** @type {import('../../../shared/types/processing/index.js').Processing} */
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (req.query.key && req.query.key !== processing.webhookKey) {
    return res.status(403).send('Mauvaise clé de déclenchement')
  } else {
    const reqSession = await session.req(req)
    if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions ?? [], reqSession) ?? '')) return res.status(403).send()
  }
  if (!processing.active) return res.status(409).send('Le traitement n\'est pas actif')
  res.send(await createNext(mongo.db, processing, true, req.query.delay ? Number(req.query.delay) : 0))
}))
