const express = require('express')
const ajv = require('ajv')()
const processingschema = require('../../contract/processing')
const validate = ajv.compile(processingschema)
const findUtils = require('../utils/find')
const asyncWrap = require('../utils/async-wrap')
const permissions = require('../utils/permissions')
const runs = require('../utils/runs')
const session = require('../utils/session')
const router = express.Router()
const { nanoid } = require('nanoid')
const cryptoRandomString = require('crypto-random-string')

module.exports = router

// Get the list of processings
router.get('', session.requiredAuth, permissions.isAdmin, asyncWrap(async (req, res, next) => {
  const sort = findUtils.sort(req.query.sort)
  const [skip, size] = findUtils.pagination(req.query)
  const query = findUtils.query(req)
  const project = {}
  const processings = req.app.get('db').collection('processings')
  const [results, count] = await Promise.all([
    size > 0 ? processings.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    processings.countDocuments(query),
  ])
  res.json({ results, count })
}))

// Create a processing
router.post('', session.requiredAuth, permissions.isAdmin, asyncWrap(async(req, res, next) => {
  const db = req.app.get('db')
  req.body._id = nanoid()
  if (req.body.owner && !req.user.adminMode) return res.status(403).send('owner can only be set for superadmin')
  req.body.owner = req.body.owner || req.user.activeAccount
  req.body.scheduling = req.body.scheduling || { type: 'trigger' }
  req.body.webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  req.body.created = req.body.updated = {
    id: req.user.id,
    name: req.user.name,
    date: new Date().toISOString(),
  }
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await db.collection('processings').insertOne(req.body)
  await runs.applyProcessing(db, req.body)
  res.status(200).json(req.body)
}))

// Patch some of the attributes of a processing
router.patch('/:id', session.requiredAuth, permissions.isAdmin, asyncWrap(async(req, res, next) => {
  const db = req.app.get('db')
  const processing = await db.collection('processings').findOne({ _id: req.params.id }, { projection: {} })
  if (!processing) return res.status(404)
  // Restrict the parts of the processing that can be edited by API
  const acceptedParts = Object.keys(processingschema.properties)
    .filter(k => !processingschema.properties[k].readOnly)
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported patch part ' + key)
  }
  req.body.updated = {
    id: req.user.id,
    name: req.user.name,
    date: new Date(),
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
  const patchedprocessing = Object.assign({}, processing, req.body)
  var valid = validate(JSON.parse(JSON.stringify(patchedprocessing)))
  if (!valid) return res.status(400).send(validate.errors)
  await db.collection('processings').findOneAndUpdate({ _id: req.params.id }, patch)
  await runs.applyProcessing(db, patchedprocessing)
  res.status(200).json(patchedprocessing)
}))

router.get('/:id', session.requiredAuth, asyncWrap(async(req, res, next) => {
  const processing = await req.app.get('db').collection('processings')
    .findOne({ _id: req.params.id }, { projection: {} })
  if (!processing) return res.sendStatus(404)
  if (!permissions.isOwner(req.user, processing)) return res.sendStatus(403)
  res.status(200).json(processing)
}))

router.delete('/:id', session.requiredAuth, permissions.isAdmin, asyncWrap(async(req, res, next) => {
  const db = req.app.get('db')
  const processing = await db.collection('processings')
    .findOneAndDelete({ _id: req.params.id })
  if (processing && processing.value) await runs.deleteProcessing(req.body)
  res.sendStatus(204)
}))
