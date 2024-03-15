import { session, asyncHandler } from '@data-fair/lib/express/index.js'
import { Router } from 'express'
import mongo from '@data-fair/lib/node/mongo.js'
import findUtils from '../utils/find.js'
import permissions from '../utils/permissions.js'

const router = Router()
export default router

const sensitiveParts = ['permissions']

/**
 * Remove sensitive parts from a run object (permissions)
 * @param {import('../../../shared/types/run/index.js').Run} run the run object to clean
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @returns {import('../../../shared/types/run/index.js').Run} the cleaned run object
 */
const cleanRun = (run, reqSession) => {
  run.userProfile = permissions.getUserResourceProfile(run.owner, run.permissions ?? [], reqSession)
  if (run.userProfile !== 'admin') {
    for (const part of sensitiveParts) delete run[part]
  }
  return run
}

router.get('', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  const sort = findUtils.sort(req.query.sort)
  const [size, skip] = findUtils.pagination(req.query.size, req.query.page, req.query.skip)
  // implicit showAll on runs if we are looking at a processing in adminMode
  if (reqSession.user.adminMode) req.query.showAll = 'true'
  const query = findUtils.query(req.query, reqSession, { processing: 'processing._id' })
  const project = { log: 0 }
  const runsCollection = mongo.db.collection('runs')
  const [runs, count] = await Promise.all([
    size > 0 ? runsCollection.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    runsCollection.countDocuments(query)
  ])
  const results = runs.map((run) => cleanRun(run, reqSession))
  res.send({ results, count })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  /** @type {import('../../../shared/types/run/index.js').Run} */
  const run = await mongo.db.collection('runs').findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(run.owner, run.permissions ?? [], reqSession) ?? '')) return res.status(403).send()
  res.send(cleanRun(run, reqSession))
}))

router.post('/:id/_kill', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)
  /** @type {import('../../../shared/types/run/index.js').Run} */
  const run = await mongo.db.collection('runs').findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(run.owner, run.permissions ?? [], reqSession) ?? '')) return res.status(403).send()
  await mongo.db.collection('runs').updateOne({ _id: run._id }, { $set: { status: 'kill' } })
  run.status = 'kill'
  res.send(cleanRun(run, reqSession))
}))
