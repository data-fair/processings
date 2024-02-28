import config from 'config'
import fs from 'fs-extra'
import path from 'path'
import { Router } from 'express'
import { nanoid } from 'nanoid'
import cryptoRandomString from 'crypto-random-string'
import createError from 'http-errors'
import resolvePath from 'resolve-path'
import processingSchema from '../../../contract/processing.cjs'
import findUtils from '../utils/find.js'
import permissions from '../utils/permissions.js'
import { createNext, applyProcessing, deleteProcessing } from '../utils/runs.js'
import mongo from '@data-fair/lib/node/mongo.js'
import { session, asyncHandler } from '@data-fair/lib/express/index.js'
import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'

const ajv = ajvFormats(new Ajv({ strict: false }))
const pluginsDir = path.join(config.dataDir, 'plugins')

const sensitiveParts = ['permissions', 'webhookKey', 'config']

const router = Router()
export default router

const validateFullProcessing = async (processing) => {
  // config is required only after the processing was activated
  const schema = processing.active
    ? { ...processingSchema, required: [...processingSchema.required, 'config'] }
    : processingSchema
  const validate = ajv.compile(schema)
  const valid = validate(processing)
  if (!valid) throw createError(400, JSON.stringify(validate.errors))
  if (!await fs.pathExists(path.join(pluginsDir, processing.plugin))) throw createError(400, 'Plugin not found')
  if (!processing.config) return
  const pluginInfo = await fs.readJson(path.join(pluginsDir, path.join(processing.plugin, 'plugin.json')))
  const configValidate = ajv.compile(pluginInfo.processingConfigSchema)
  const configValid = configValidate(processing.config)
  if (!configValid) throw createError(400, JSON.stringify(configValidate.errors))
}

const cleanProcessing = (processing, reqSession) => {
  delete processing.webhookKey
  processing.userProfile = permissions.getUserResourceProfile(processing, reqSession)
  if (processing.userProfile !== 'admin') {
    for (const part of sensitiveParts) delete processing[part]
  }
  return processing
}

// Get the list of processings
router.get('', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  const sort = findUtils.sort(req.query.sort)
  const [skip, size] = findUtils.pagination(req.query)
  const query = findUtils.query(req, reqSession)
  const project = findUtils.project(req.query.select)
  const processings = await mongo.db.collection('processings')
  const [results, count] = await Promise.all([
    size > 0 ? processings.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    processings.countDocuments(query)
  ])
  res.json({ results: results.map(p => cleanProcessing(p, reqSession)), count })
}))

// Create a processing
router.post('', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  req.body._id = nanoid()
  if (req.body.owner && !reqSession.user.adminMode) return res.status(403).send('owner can only be set for superadmin')
  req.body.owner = req.body.owner || reqSession.account
  if (!permissions.isAdmin(reqSession, req.body)) return res.status(403).send()
  req.body.scheduling = req.body.scheduling || { type: 'trigger' }
  req.body.webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  req.body.created = req.body.updated = {
    id: reqSession.user.id,
    name: reqSession.user.name,
    date: new Date().toISOString()
  }

  const access = await fs.pathExists(resolvePath(pluginsDir, req.body.plugin + '-access.json')) ? await fs.readJson(resolvePath(pluginsDir, req.body.plugin + '-access.json')) : { public: false, privateAccess: [] }
  if (reqSession.user.adminMode) {
    // ok for super admins
  } else if (access && access.public) {
    // ok, this plugin is public
  } else if (access && access.privateAccess && access.privateAccess.find(p => p.type === req.body.owner.type && p.id === req.body.owner.id)) {
    // ok, private access is granted
  } else {
    return res.status(403).send()
  }

  await validateFullProcessing(req.body)
  await mongo.db.collection('processings').insertOne(req.body)
  await applyProcessing(mongo.db, req.body)
  res.status(200).json(cleanProcessing(req.body, reqSession))
}))

// Patch some of the attributes of a processing
router.patch('/:id', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id }, { projection: {} })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing, reqSession) !== 'admin') return res.status(403).send()
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
  const patchedprocessing = { ...processing, ...req.body }
  await validateFullProcessing(patchedprocessing)
  await mongo.db.collection('processings').updateOne({ _id: req.params.id }, patch)
  await mongo.db.collection('runs').updateMany({ 'processing._id': processing._id }, { $set: { permissions: patchedprocessing.permissions || [] } })
  await applyProcessing(mongo.db, patchedprocessing)
  res.status(200).json(cleanProcessing(patchedprocessing, reqSession))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  const processing = await mongo.db.collection('processings')
    .findOne({ _id: req.params.id }, { projection: {} })
  if (!processing) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing, reqSession))) return res.status(403).send()
  res.status(200).json(cleanProcessing(processing, reqSession))
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing, reqSession) !== 'admin') return res.status(403).send()
  await mongo.db.collection('processings').deleteOne({ _id: req.params.id })
  if (processing && processing.value) await deleteProcessing(mongo.db, processing)
  res.sendStatus(204)
}))

router.get('/:id/webhook-key', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing, reqSession) !== 'admin') return res.status(403).send()
  res.send(processing.webhookKey)
}))

router.delete('/:id/webhook-key', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  const processing = await mongo.db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing, reqSession) !== 'admin') return res.status(403).send()
  const webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  await mongo.db.collection('processings').updateOne(
    { _id: processing._id },
    { $set: { webhookKey } }
  )
  res.send(webhookKey)
}))

router.post('/:id/_trigger', asyncHandler(async (req, res) => {
  const processing = await mongo.db.collection('processings')
    .findOne({ _id: req.params.id }, { projection: {} })
  if (req.query.key) {
    if (req.query.key !== processing.webhookKey) {
      return res.status(403).send('Mauvaise clé de déclenchement')
    }
  } else {
    const reqSession = await session.req(req)
    if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(processing, reqSession))) return res.status(403).send()
  }
  if (!processing.active) return res.status(409).send('Le traitement n\'est pas actif')
  res.send(await createNext(mongo.db, processing, true, req.query.delay ? Number(req.query.delay) : 0))
}))
