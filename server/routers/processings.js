const express = require('express')
const ajv = require('ajv')()
const processingschema = require('../../contract/processing')
const validate = ajv.compile(processingschema)
const findUtils = require('../utils/find')
const asyncWrap = require('../utils/async-wrap')
const slug = require('slugify')
const scheduler = require('../utils/scheduler')
const tasksUtils = require('../utils/tasks')
const permissions = require('../utils/permissions')
const router = express.Router()

module.exports = router

router.get('/_schema', asyncWrap(async(req, res, next) => {
  res.status(200).json(processingschema)
}))

router.post('/_init-dataset', permissions.isAdmin, asyncWrap(async(req, res, next) => {
  res.status(200).send(await tasksUtils.initDataset(req.body))
}))

// Get the list of processings
router.get('', permissions.isAdmin, asyncWrap(async (req, res, next) => {
  const sort = findUtils.sort(req.query.sort)
  const [skip, size] = findUtils.pagination(req.query)
  const query = findUtils.query(req.query)
  const project = { _id: 0, logs: 0 }
  const processings = req.app.get('db').collection('processings')
  const [results, count] = await Promise.all([
    size > 0 ? processings.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    processings.countDocuments(query)
  ])
  res.json({ results, count })
}))

// Create a processing
router.post('', permissions.isAdmin, asyncWrap(async(req, res, next) => {
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  req.body.status = req.body.status || 'stopped'
  req.body.created = req.body.updated = {
    id: req.user.id,
    name: req.user.name,
    date: new Date()
  }
  // Generate ids and try insertion until there is no conflict on id
  const baseId = req.body.id || slug(req.body.title, { lower: true })
  req.body.id = baseId
  let insertOk = false
  let i = 1
  while (!insertOk) {
    try {
      await req.app.get('db').collection('processings').insertOne(req.body)
      insertOk = true
    } catch (err) {
      if (err.code !== 11000) throw err
      i += 1
      req.body.id = `${baseId}-${i}`
    }
  }
  delete req.body._id
  if (req.body.status === 'running') scheduler.update(req.body, req.app.get('db'))
  res.status(200).json(req.body)
}))

// Patch some of the attributes of a processing
router.patch('/:id', permissions.isAdmin, asyncWrap(async(req, res, next) => {
  const processing = await req.app.get('db').collection('processings').findOne({ id: req.params.id }, { projection: { _id: 0, logs: 0 } })
  if (!processing) return res.status(404)
  // Restrict the parts of the processing that can be edited by API
  const acceptedParts = Object.keys(processingschema.properties).filter(k => !processingschema.properties[k].readOnly)
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported patch part ' + key)
  }
  req.body.updated = {
    id: req.user.id,
    name: req.user.name,
    date: new Date()
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
  await req.app.get('db').collection('processings').findOneAndUpdate({ id: req.params.id }, patch)
  if (patchedprocessing.active) scheduler.update(patchedprocessing, req.app.get('db'))
  else scheduler.delete(patchedprocessing.id)
  res.status(200).json(patchedprocessing)
}))

router.get('/:id', asyncWrap(async(req, res, next) => {
  const processing = await req.app.get('db').collection('processings').findOne({ id: req.params.id }, { projection: { _id: 0, logs: 0 } })
  if (!processing) return res.sendStatus(404)
  if (!permissions.isOwner(req.user, processing)) return res.sendStatus(403)
  res.status(200).json(processing)
}))

router.get('/:id/logs', asyncWrap(async(req, res, next) => {
  const processing = await req.app.get('db').collection('processings').findOne({ id: req.params.id }, { projection: { logs: 1 } })
  if (!processing) return res.sendStatus(404)
  if (!permissions.isOwner(req.user, processing)) return res.sendStatus(403)
  res.status(200).json((processing.logs || []).reverse())
}))

router.delete('/:id', permissions.isAdmin, asyncWrap(async(req, res, next) => {
  await req.app.get('db').collection('processings').deleteOne({ id: req.params.id })
  scheduler.delete(req.params.id)
  res.sendStatus(204)
}))

router.post('/:id/_run', permissions.isAdmin, asyncWrap(async (req, res, next) => {
  const db = req.app.get('db')
  const processing = await db.collection('processings').findOne({ id: req.params.id })
  await tasksUtils.run(processing, db)
  res.status(200).send()
}))

router.get('/:type/:id', permissions.isAccountAdmin, asyncWrap(async(req, res, next) => {
  const sort = findUtils.sort(req.query.sort)
  const [skip, size] = findUtils.pagination(req.query)
  const query = findUtils.query(req.query)
  query['owner.id'] = req.params.id
  const project = { _id: 0, logs: 0 }
  const processings = req.app.get('db').collection('processings')
  const [results, count] = await Promise.all([
    size > 0 ? processings.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    processings.countDocuments(query)
  ])
  res.json({ results, count })
}))
