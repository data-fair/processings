import express from 'express'
import findUtils from '../utils/find.cjs'
import asyncWrap from '../utils/async-wrap.cjs'
import permissions from '../utils/permissions.cjs'
import session from '../utils/session.cjs'
import mongo from '@data-fair/lib/node/mongo.js'

const router = express.Router()

export default router

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
  const runs = mongo.db.collection('runs')
  const [results, count] = await Promise.all([
    size > 0 ? runs.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    runs.countDocuments(query)
  ])
  res.send({ results: results.map(r => cleanRun(r, req)), count })
}))

router.get('/:id', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const run = await mongo.db.collection('runs').findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(run, req))) return res.status(403).send()
  res.send(cleanRun(run, req))
}))

router.post('/:id/_kill', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const run = await mongo.db.collection('runs').findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(run, req))) return res.status(403).send()
  await mongo.db.collection('runs').updateOne({ _id: run._id }, { $set: { status: 'kill' } })
  run.status = 'kill'
  res.send(cleanRun(run, req))
}))
