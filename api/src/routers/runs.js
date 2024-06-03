import { session, asyncHandler } from '@data-fair/lib/express/index.js'
import { Router } from 'express'
import mongo from '@data-fair/lib/node/mongo.js'
import findUtils from '../utils/find.js'
import permissions from '../utils/permissions.js'

const router = Router()
export default router

const sensitiveParts = ['permissions']

/** @typedef {import('../../../shared/types/run/index.js').Run} Run */

/**
 * Remove sensitive parts from a run object (permissions)
 * @param {Run} run the run object to clean
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {string|undefined} host req.headers.host
 * @returns {Run} the cleaned run object
 */
const cleanRun = (run, sessionState, host) => {
  run.userProfile = permissions.getUserResourceProfile(run.owner, run.permissions, sessionState, host)
  if (run.userProfile !== 'admin') {
    for (const part of sensitiveParts) delete run[part]
  }
  return run
}

/**
 * @typedef {object} getParams
 * @property {string} size
 * @property {string} page
 * @property {string} skip
 * @property {string} showAll
 * @property {string} sort
 * @property {string} select
 */

// Get the list of runs (without logs)
router.get('', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const params = /** @type {getParams} */(req.query)
  const sort = findUtils.sort(params.sort)
  const [size, skip] = findUtils.pagination(params.size, params.page, params.skip)
  // implicit showAll on runs if we are looking at a processing in adminMode
  if (sessionState.user.adminMode) params.showAll = 'true'
  const query = findUtils.query(req.query, sessionState, { processing: 'processing._id' }) // Check permissions on processing
  const project = { log: 0 }
  /** @type {import('mongodb').Collection<Run>} */
  const runsCollection = mongo.db.collection('runs')
  const [runs, count] = await Promise.all([
    size > 0 ? runsCollection.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    runsCollection.countDocuments(query)
  ])
  // @ts-ignore -> r is a run
  res.send({ results: runs.map((r) => cleanRun(r, sessionState)), count })
}))

// Get a run (with logs)
router.get('/:id', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  /** @type {import('mongodb').Collection<Run>} */
  const runsCollection = mongo.db.collection('runs')
  const run = await runsCollection.findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(run.owner, run.permissions, sessionState, req.headers.host) ?? '')) return res.status(403).send()
  if (!sessionState.user.adminMode) run.log = run.log.filter(l => l.type !== 'debug')
  res.send(cleanRun(run, sessionState, req.headers.host))
}))

// Kill a run
router.post('/:id/_kill', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  /** @type {import('mongodb').Collection<Run>} */
  const runsCollection = mongo.db.collection('runs')
  const run = await runsCollection.findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(run.owner, run.permissions, sessionState, req.headers.host) ?? '')) return res.status(403).send()
  await runsCollection.updateOne({ _id: run._id }, { $set: { status: 'kill' } })
  run.status = 'kill'
  res.send(cleanRun(run, sessionState, req.headers.host))
}))
