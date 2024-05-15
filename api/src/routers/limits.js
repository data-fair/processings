import { asyncHandler, session } from '@data-fair/lib/express/index.js'
import { getLimits } from '../../../shared/limits.js'
import { Router } from 'express'
import mongo from '@data-fair/lib/node/mongo.js'
import Ajv from 'ajv'
import AjvFormats from 'ajv-formats'
import config from '../config.js'

// @ts-ignore
const ajv = AjvFormats(new Ajv({ strict: false }))

const schema = {
  type: 'object',
  required: ['id', 'type', 'lastUpdate'],
  properties: {
    type: { type: 'string' },
    id: { type: 'string' },
    name: { type: 'string' },
    lastUpdate: { type: 'string', format: 'date-time' },
    defaults: { type: 'boolean', title: 'these limits were defined using default values only, not specifically defined' },
    processings_seconds: {
      limit: {
        type: 'number'
      },
      consumption: {
        type: 'number'
      }
    }
  }
}
const validate = ajv.compile(schema)

const router = Router()
export default router

/**
 * Middleware to check the req.params (representing a user account or organization)
 * indeed belongs to the currently logged-in user,
 * or to an organization of which the currently logged-in user is a member.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const isAccountMember = async (req, res, next) => {
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
  req.body.type = req.params.type
  req.body.id = req.params.id
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await mongo.db.collection('limits')
    .replaceOne({ type: req.params.type, id: req.params.id }, req.body, { upsert: true })
  res.send(req.body)
}))

// A user can get limits information for himself only
router.get('/:type/:id', isAccountMember, asyncHandler(async (req, res) => {
  const consumer = { type: req.params.type, id: req.params.id }
  const limits = await getLimits(mongo.db, consumer)
  if (!limits) return res.status(404).send()
  delete limits._id
  res.send(limits)
}))

router.get('/', asyncHandler(async (req, res) => {
  if (req.query.key !== config.secretKeys.limits) {
    await session.reqAdminMode(req)
  }

  const filter = {}
  if (req.query.type) filter.type = req.query.type
  if (req.query.id) filter.id = req.query.id
  const results = await mongo.db.collection('limits')
    .find(filter)
    .sort({ lastUpdate: -1 })
    .project({ _id: 0 })
    .limit(10000)
    .toArray()
  res.send({ results, count: results.length })
}))
