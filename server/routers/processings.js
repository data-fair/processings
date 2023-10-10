const config = require('config')
const fs = require('fs-extra')
const path = require('path')
const express = require('express')
const { nanoid } = require('nanoid')
const cryptoRandomString = require('crypto-random-string')
const createError = require('http-errors')
const ajv = require('ajv')({ allErrors: false })
const processingSchema = require('../../contract/processing')
const findUtils = require('../utils/find')
const asyncWrap = require('../utils/async-wrap')
const permissions = require('../utils/permissions')
const runs = require('../utils/runs')
const session = require('../utils/session')

const pluginsDir = path.join(config.dataDir, 'plugins')

const sensitiveParts = ['permissions', 'webhookKey', 'config']

const router = module.exports = express.Router()

const validateFullProcessing = async (processing) => {
  // config is required only after the processing was activated
  const schema = processing.active
    ? { ...processingSchema, required: [...processingSchema.required, 'config'] }
    : processingSchema
  const validate = ajv.compile(schema)
  const valid = validate(processing)
  if (!valid) throw createError(400, JSON.stringify(validate.errors))
  if (!processing.config) return
  const pluginInfo = await fs.readJson(path.join(pluginsDir, processing.plugin, 'plugin.json'))
  const configValidate = ajv.compile(pluginInfo.processingConfigSchema)
  const configValid = configValidate(processing.config)
  if (!configValid) throw createError(400, JSON.stringify(configValidate.errors))
}

const cleanProcessing = (processing, user) => {
  delete processing.webhookKey
  processing.userProfile = permissions.getUserResourceProfile(processing, user)
  if (processing.userProfile !== 'admin') {
    for (const part of sensitiveParts) delete processing[part]
  }
  return processing
}

// Get the list of processings
router.get('', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const sort = findUtils.sort(req.query.sort)
  const [skip, size] = findUtils.pagination(req.query)
  const query = findUtils.query(req)
  const project = findUtils.project(req.query.select)
  const processings = req.app.get('db').collection('processings')
  const [results, count] = await Promise.all([
    size > 0 ? processings.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    processings.countDocuments(query)
  ])
  res.json({ results: results.map(p => cleanProcessing(p, req.user)), count })
}))

// Create a processing
router.post('', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const db = req.app.get('db')
  req.body._id = nanoid()
  if (req.body.owner && !req.user.adminMode) return res.status(403).send('owner can only be set for superadmin')
  req.body.owner = req.body.owner || req.user.accountOwner
  if (!permissions.isAdmin(req.user, req.body)) return res.status(403).send()
  req.body.scheduling = req.body.scheduling || { type: 'trigger' }
  req.body.webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  req.body.created = req.body.updated = {
    id: req.user.id,
    name: req.user.name,
    date: new Date().toISOString()
  }

  const access = await fs.pathExists(path.join(pluginsDir, req.body.plugin + '-access.json')) ? await fs.readJson(path.join(pluginsDir, req.body.plugin + '-access.json')) : { public: false, privateAccess: [] }
  if (req.user.adminMode) {
    // ok for super admins
  } else if (access && access.public) {
    // ok, this plugin is public
  } else if (access && access.privateAccess && access.privateAccess.find(p => p.type === req.body.owner.type && p.id === req.body.owner.id)) {
    // ok, private access is granted
  } else {
    return res.status(403).send()
  }

  await validateFullProcessing(req.body)
  await db.collection('processings').insertOne(req.body)
  await runs.applyProcessing(db, req.body)
  res.status(200).json(cleanProcessing(req.body, req.user))
}))

// Patch some of the attributes of a processing
router.patch('/:id', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const db = req.app.get('db')
  const processing = await db.collection('processings').findOne({ _id: req.params.id }, { projection: {} })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing, req.user) !== 'admin') return res.status(403).send()
  // Restrict the parts of the processing that can be edited by API
  const acceptedParts = Object.keys(processingSchema.properties)
    .filter(k => req.user.adminMode || !processingSchema.properties[k].readOnly)
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported patch part ' + key)
  }
  req.body.updated = {
    id: req.user.id,
    name: req.user.name,
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
  await db.collection('processings').updateOne({ _id: req.params.id }, patch)
  await db.collection('runs').updateMany({ 'processing._id': processing._id }, { $set: { permissions: patchedprocessing.permissions || [] } })
  await runs.applyProcessing(db, patchedprocessing)
  res.status(200).json(cleanProcessing(patchedprocessing, req.user))
}))

router.get('/:id', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const processing = await req.app.get('db').collection('processings')
    .findOne({ _id: req.params.id }, { projection: {} })
  if (!processing) return res.status(404).send()
  console.log('PROFILE', permissions.getUserResourceProfile(processing, req.user))
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing, req.user))) return res.status(403).send()
  res.status(200).json(cleanProcessing(processing, req.user))
}))

router.delete('/:id', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const db = req.app.get('db')
  const processing = await db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing, req.user) !== 'admin') return res.status(403).send()
  await db.collection('processings').deleteOne({ _id: req.params.id })
  if (processing && processing.value) await runs.deleteProcessing(db, processing)
  res.sendStatus(204)
}))

router.get('/:id/webhook-key', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const db = req.app.get('db')
  const processing = await db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing, req.user) !== 'admin') return res.status(403).send()
  res.send(processing.webhookKey)
}))

router.delete('/:id/webhook-key', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const db = req.app.get('db')
  const processing = await db.collection('processings').findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing, req.user) !== 'admin') return res.status(403).send()
  const webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  await db.collection('processings').updateOne(
    { _id: processing._id },
    { $set: { webhookKey } }
  )
  res.send(webhookKey)
}))

router.post('/:id/_trigger', session.auth, asyncWrap(async (req, res, next) => {
  const db = req.app.get('db')
  const processing = await db.collection('processings')
    .findOne({ _id: req.params.id }, { projection: {} })
  if (req.query.key) {
    if (req.query.key !== processing.webhookKey) {
      return res.status(403).send('Mauvaise clé de déclenchement')
    }
  } else {
    if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(processing, req.user))) return res.status(403).send()
  }
  if (!processing.active) return res.status(409).send('Le traitement n\'est pas actif')
  res.send(await runs.createNext(db, processing, true, req.query.delay ? Number(req.query.delay) : 0))
}))
