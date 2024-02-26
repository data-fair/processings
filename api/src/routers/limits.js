import { Router } from 'express'
import { asyncHandler } from '@data-fair/lib/express/index.js'
import permissions from '../utils/permissions.js'
import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'

const ajv = ajvFormats(new Ajv({ strict: false }))

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

// Endpoint for customers service to create/update limits
router.post('/:type/:id', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  req.body.type = req.params.type
  req.body.id = req.params.id
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await req.app.get('db').collection('limits')
    .replaceOne({ type: req.params.type, id: req.params.id }, req.body, { upsert: true })
  res.send(req.body)
}))

// A user can get limits information for himself only
router.get('/:type/:id', permissions.isAccountMember, asyncHandler(async (req, res) => {
  const limits = await exports.getLimits(req.app.get('db'), { type: req.params.type, id: req.params.id })
  if (!limits) return res.status(404).send()
  delete limits._id
  res.send(limits)
}))

router.get('/', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.type) filter.type = req.query.type
  if (req.query.id) filter.id = req.query.id
  const results = await req.app.get('db').collection('limits')
    .find(filter)
    .sort({ lastUpdate: -1 })
    .project({ _id: 0 })
    .limit(10000)
    .toArray()
  res.send({ results, count: results.length })
}))
