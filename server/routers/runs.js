const express = require('express')
const findUtils = require('../utils/find')
const asyncWrap = require('../utils/async-wrap')
const permissions = require('../utils/permissions')
const session = require('../utils/session')
const router = express.Router()

module.exports = router

const sensitiveParts = ['permissions']

const cleanRun = (run, req) => {
  run.userProfile = permissions.getUserResourceProfile(run, req)
  if (run.userProfile !== 'admin') {
    for (const part of sensitiveParts) delete run[part]
  }
  return run
}

router.get('', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const sort = findUtils.sort(req.query.sort)
  const [skip, size] = findUtils.pagination(req.query)
  // implicit showAll on runs if we are looking at a processing in adminMode
  if (req.user.adminMode) req.query.showAll = 'true'
  const query = findUtils.query(req, { processing: 'processing._id' })
  const project = { log: 0 }
  const runs = req.app.get('db').collection('runs')
  const [results, count] = await Promise.all([
    size > 0 ? runs.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    runs.countDocuments(query)
  ])
  res.send({ results: results.map(r => cleanRun(r, req)), count })
}))

router.get('/:id', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const run = await req.app.get('db').collection('runs').findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(run, req))) return res.status(403).send()
  res.send(cleanRun(run, req))
}))

router.post('/:id/_kill', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const run = await req.app.get('db').collection('runs').findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(run, req))) return res.status(403).send()
  await req.app.get('db').collection('runs').updateOne({ _id: run._id }, { $set: { status: 'kill' } })
  run.status = 'kill'
  res.send(cleanRun(run, req))
}))
