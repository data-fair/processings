import type { Run } from '#types/index.js'
import type { SessionStateAuthenticated } from '@data-fair/lib-express/index.js'

import { session, asyncHandler } from '@data-fair/lib-express/index.js'
import { Router } from 'express'
import mongo from '#mongo'
import findUtils from '../utils/find.ts'
import permissions from '../utils/permissions.ts'

const router = Router()
export default router

const sensitiveParts = ['permissions']

/**
 * Remove sensitive parts from a run object (permissions)
 * @param run the run object to clean
 * @param sessionState
 * @param host req.headers.host
 * @returns the cleaned run object
 */
const cleanRun = (run: Run, sessionState: SessionStateAuthenticated, host: string | undefined): Run => {
  run.userProfile = permissions.getUserResourceProfile(run.owner, run.permissions, sessionState, host)
  if (run.userProfile !== 'admin') {
    for (const part of sensitiveParts) delete run[part]
  }
  return run
}

// Get the list of runs (without logs)
router.get('', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const params = (await import ('#doc/runs/get-req/index.ts')).returnValid(req.query)
  const sort = findUtils.sort(params.sort)
  const [size, skip] = findUtils.pagination(params.size, params.page, params.skip)
  // implicit showAll on runs if we are looking at a processing in adminMode
  if (sessionState.user.adminMode) params.showAll = 'true'
  const query = findUtils.query(params, sessionState, { processing: 'processing._id' }) // Check permissions on processing
  const project = { log: 0 }
  const [runs, count] = await Promise.all([
    size > 0 ? mongo.runs.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    mongo.runs.countDocuments(query)
  ])
  res.send({ results: runs.map((r) => cleanRun(r as Run, sessionState, req.headers.host)), count })
}))

// Get a run (with logs)
router.get('/:id', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const run = await mongo.runs.findOne({ _id: req.params.id }) as Run
  if (!run) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(run.owner, run.permissions, sessionState, req.headers.host) ?? '')) return res.status(403).send()
  if (!sessionState.user.adminMode && run.log) run.log = run.log.filter(l => l.type !== 'debug')
  res.send(cleanRun(run, sessionState, req.headers.host))
}))

// Kill a run
router.post('/:id/_kill', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const run = await mongo.runs.findOne({ _id: req.params.id })
  if (!run) return res.status(404).send()
  if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(run.owner, run.permissions, sessionState, req.headers.host) ?? '')) return res.status(403).send()
  await mongo.runs.updateOne({ _id: run._id }, { $set: { status: 'kill' } })
  run.status = 'kill'
  res.send(cleanRun(run, sessionState, req.headers.host))
}))
