import type { Request, Response, NextFunction } from 'express'
import { Router } from 'express'

import { asyncHandler, session } from '@data-fair/lib-express/index.js'
import { getLimits } from '../../../shared/limits.ts'
import mongo from '#mongo'
import config from '#config'

const router = Router()
export default router

/**
 * Middleware to check the req.params (representing a user account or organization)
 * indeed belongs to the currently logged-in user,
 * or to an organization of which the currently logged-in user is a member.
 */
const isAccountMember = async (req: Request, res: Response, next: NextFunction) => {
  if (req.query.key === config.secretKeys.limits) return next()
  const sessionState = await session.req(req)
  if (!sessionState.user) return res.status(401).send()
  if (sessionState.user.adminMode) return next()
  if (!['organization', 'user'].includes(req.params.type)) return res.status(400).send('Wrong consumer type')
  if (req.params.type === 'user') {
    if (sessionState.user.id !== req.params.id) return res.status(403).send()
  }
  if (req.params.type === 'organization') {
    const org = sessionState.user.organizations.find(o => o.id === req.params.id)
    if (!org) return res.status(403).send()
  }
  next()
}

// Endpoint for customers service to create/update limits
router.post('/:type/:id', asyncHandler(async (req, res) => {
  if (req.query.key !== config.secretKeys.limits) {
    await session.reqAdminMode(req)
  }
  const body = (await import ('#doc/limits/post-req/index.ts')).returnValid(req.body, { name: 'req' })

  body.type = req.params.type
  body.id = req.params.id
  await mongo.limits
    .replaceOne({ type: req.params.type, id: req.params.id }, body, { upsert: true })
  res.send(body)
}))

// A user can get limits information for himself only
router.get('/:type/:id', isAccountMember, asyncHandler(async (req, res) => {
  const consumer = { type: req.params.type, id: req.params.id }
  const limits = await getLimits(mongo, consumer)
  if (!limits) return res.status(404).send()
  delete limits._id
  res.send(limits)
}))

router.get('/', asyncHandler(async (req, res) => {
  if (req.query.key !== config.secretKeys.limits) {
    await session.reqAdminMode(req)
  }
  const filter: Record<string, any> = {}
  if (req.query.type) filter.type = req.query.type
  if (req.query.id) filter.id = req.query.id
  const results = await mongo.limits
    .find(filter)
    .sort({ lastUpdate: -1 })
    .project({ _id: 0 })
    .limit(10000)
    .toArray()
  res.send({ results, count: results.length })
}))
