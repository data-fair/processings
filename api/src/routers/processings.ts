import type { Processing } from '#types'
import type { SessionStateAuthenticated } from '@data-fair/lib-express/index.js'

import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'
import cryptoRandomString from 'crypto-random-string'
import { Router } from 'express'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'
import { nanoid } from 'nanoid'

import { session } from '@data-fair/lib-express/index.js'
import { httpError } from '@data-fair/lib-utils/http-errors.js'
import { createNext } from '@data-fair/processings-shared/runs.ts'
import { applyProcessing, deleteProcessing } from '../utils/runs.ts'
import mongo from '#mongo'
import config from '#config'
import locks from '#locks'
import { resolvedSchema as processingSchema } from '#types/processing/index.ts'
import findUtils from '../utils/find.ts'
import permissions from '../utils/permissions.ts'

const router = Router()
export default router

// @ts-ignore
const ajv = ajvFormats(new Ajv({ strict: false }))
const pluginsDir = path.join(config.dataDir, 'plugins')

const sensitiveParts = ['permissions', 'webhookKey', 'config']

/**
 * Check that a processing object is valid
 * Check if the plugin exists
 * Check if the config is valid (only if the processing is activated)
 */
const validateFullProcessing = async (processing: Processing) => {
  (await import('#types/processing/index.ts')).returnValid(processing)
  if (processing.active && !processing.config) throw httpError(400, 'Config is required for an active processing')
  if (!await fs.pathExists(path.join(pluginsDir, processing.plugin))) throw httpError(400, 'Plugin not found')
  if (!processing.config) return // no config to validate
  const pluginInfo = await fs.readJson(path.join(pluginsDir, path.join(processing.plugin, 'plugin.json')))
  const configValidate = ajv.compile(pluginInfo.processingConfigSchema)
  const configValid = configValidate(processing.config)
  if (!configValid) throw httpError(400, JSON.stringify(configValidate.errors))
}

/**
 * Remove sensitive parts from a processing object (permissions, webhookKey and config)
 * @param processing the processing object to clean
 * @param sessionState the session state
 * @param host the req.headers.host
 * @returns the cleaned processing object
 */
const cleanProcessing = (processing: Processing, sessionState: SessionStateAuthenticated) => {
  delete processing.webhookKey
  processing.userProfile = permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState)
  if (processing.userProfile !== 'admin') {
    for (const part of sensitiveParts) delete (processing as any)[part]
  }
  return processing
}

// Get the list of processings
router.get('', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const params = (await import('#doc/processings/get-req/index.ts')).returnValid(req.query)
  const sort = findUtils.sort(params.sort)
  const [size, skip] = findUtils.pagination(params.size, params.page, params.skip)
  const project = findUtils.project(params.select)
  const query = findUtils.query(params, sessionState) // Check permissions

  const queryWithFilters = { ...query }
  // Filter by statuses
  const statuses = params.statuses ? params.statuses.split(',') : []
  if (statuses.length > 0) {
    queryWithFilters.$and = queryWithFilters.$and || []
    queryWithFilters.$and.push({
      $or: [
        statuses.includes('none') ? { lastRun: { $exists: false } } : null,
        statuses.includes('scheduled') ? { nextRun: { $exists: true } } : null,
        { 'lastRun.status': { $in: statuses } }
      ].filter(Boolean)
    })
  }
  // Filter by plugins
  const plugins = params.plugins ? params.plugins.split(',') : []
  if (plugins.length > 0) {
    queryWithFilters.plugin = { $in: plugins }
  }

  // Get the processings
  const [results, count] = await Promise.all([
    size > 0 ? mongo.processings.find(queryWithFilters).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    mongo.processings.countDocuments(query)
  ])

  const aggregationPipeline = [
    {
      $facet: {
        scheduled: [
          {
            $match: { nextRun: { $exists: true } }
          },
          {
            $group: {
              _id: 'scheduled',
              count: { $sum: 1 }
            }
          }
        ],
        otherStatuses: [
          {
            $group: {
              _id: {
                $cond: [
                  { $eq: [{ $ifNull: ['$lastRun', 'none'] }, 'none'] },
                  'none',
                  '$lastRun.status'
                ]
              },
              count: { $sum: 1 }
            }
          }
        ],
        plugins: [
          {
            $group: {
              _id: '$plugin',
              count: { $sum: 1 }
            }
          }
        ]
      }
    },
    {
      $replaceRoot: {
        newRoot: {
          statuses: {
            $mergeObjects: [
              { scheduled: { $ifNull: [{ $arrayElemAt: ['$scheduled.count', 0] }, 0] } },
              { $arrayToObject: { $map: { input: '$otherStatuses', as: 'el', in: { k: '$$el._id', v: '$$el.count' } } } }
            ]
          },
          plugins: { $arrayToObject: { $map: { input: '$plugins', as: 'el', in: { k: '$$el._id', v: '$$el.count' } } } }
        }
      }
    }
  ] as any[]

  // Get for each owner (user/organization OR department) the number of processings
  if (params.showAll === 'true') {
    aggregationPipeline[0].$facet.owners = [
      {
        $group: {
          _id: {
            type: '$owner.type',
            id: '$owner.id',
            name: '$owner.name',
            department: { $ifNull: ['$owner.department', null] },
            departmentName: { $ifNull: ['$owner.departmentName', null] }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          count: 1,
          value: {
            type: '$_id.type',
            id: '$_id.id',
            name: '$_id.name',
            department: '$_id.department',
            departmentName: '$_id.departmentName'
          }
        }
      },
      {
        $group: {
          _id: {
            type: '$value.type',
            id: '$value.id',
            name: '$value.name'
          },
          totalCount: { $sum: '$count' },
          departments: {
            $push: {
              department: '$value.department',
              departmentName: '$value.departmentName',
              count: '$count'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id.type',
          id: '$_id.id',
          name: '$_id.name',
          totalCount: 1,
          departments: {
            $filter: {
              input: '$departments',
              as: 'dept',
              cond: { $ne: ['$$dept.department', null] } // Filtrer les départements null
            }
          }
        }
      }
    ]

    // Ajout des `owners` dans le résultat final
    aggregationPipeline[1].$replaceRoot.newRoot.owners = { $ifNull: ['$owners', []] }
  } else {
    aggregationPipeline.unshift({ $match: query })
  }

  const aggregationResult = await mongo.processings.aggregate(aggregationPipeline).toArray()
  const facets = aggregationResult[0] || { statuses: {}, plugins: {}, owners: [] }

  res.json({ results: results.map((p) => cleanProcessing(p as Processing, sessionState)), facets, count })
})

router.post('', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = { ...req.body }
  processing._id = nanoid()
  processing.owner = processing.owner ?? sessionState.account
  if (!permissions.isAdmin(sessionState, processing.owner)) return res.status(403).send('No permission to create a processing')
  processing.scheduling = processing.scheduling || []
  processing.webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  processing.created = processing.updated = {
    id: sessionState.user.id,
    name: sessionState.user.name,
    date: new Date().toISOString()
  }

  const access = await fs.pathExists(resolvePath(pluginsDir, processing.plugin + '-access.json')) ? await fs.readJson(resolvePath(pluginsDir, processing.plugin + '-access.json')) : { public: false, privateAccess: [] }
  if (sessionState.user.adminMode) {
    // ok for super admins
  } else if (access && access.public) {
    // ok, this plugin is public
  } else if (access && access.privateAccess && access.privateAccess.find((p: any) => p.type === processing.owner.type && p.id === processing.owner.id)) {
    // ok, private access is granted
  } else {
    return res.status(403).send('Access denied to this plugin')
  }

  await validateFullProcessing(processing)
  await mongo.processings.insertOne(processing)
  res.status(200).json(cleanProcessing(processing, sessionState))
})

// Patch some of the attributes of a processing
router.patch('/:id', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()

  // Restrict the parts of the processing that can be edited by API
  const acceptedParts = Object.keys(processingSchema.properties)
    .filter(k => sessionState.user.adminMode || !(processingSchema.properties)[k].readOnly)
  for (const key in req.body) {
    if (!acceptedParts.includes(key)) return res.status(400).send('Unsupported patch part ' + key)
  }
  req.body.updated = {
    id: sessionState.user.id,
    name: sessionState.user.name,
    date: new Date().toISOString()
  }

  const patch: { $unset?: { [key: string]: true }, $set?: { [key: string]: any } } = {}
  for (const key in req.body) {
    if (req.body[key] === null) {
      patch.$unset = patch.$unset || {}
      patch.$unset[key] = true
      delete req.body[key]
    } else {
      patch.$set = patch.$set || {}
      patch.$set[key] = req.body[key]
    }
  }
  const patchedProcessing = { ...processing, ...req.body }
  await validateFullProcessing(patchedProcessing)
  await mongo.processings.updateOne({ _id: req.params.id }, patch)
  await mongo.runs.updateMany({ 'processing._id': processing._id }, { $set: { permissions: patchedProcessing.permissions || [] } })
  await applyProcessing(mongo, patchedProcessing)
  res.status(200).json(cleanProcessing(patchedProcessing, sessionState))
})

// Get a processing
router.get('/:id', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (!['admin', 'exec', 'read'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) ?? '')) return res.status(403).send()
  res.status(200).json(cleanProcessing(processing, sessionState))
})

// Delete a processing
router.delete('/:id', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  await mongo.processings.deleteOne({ _id: req.params.id })
  if (processing) await deleteProcessing(mongo, processing)
  res.sendStatus(204)
})

router.get('/:id/webhook-key', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  res.send(processing.webhookKey)
})

router.delete('/:id/webhook-key', async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) !== 'admin') return res.status(403).send()
  const webhookKey = cryptoRandomString({ length: 16, type: 'url-safe' })
  await mongo.processings.updateOne(
    { _id: processing._id },
    { $set: { webhookKey } }
  )
  res.send(webhookKey)
})

router.post('/:id/_trigger', async (req, res) => {
  const processing = await mongo.processings.findOne({ _id: req.params.id })
  if (!processing) return res.status(404).send()
  if (req.query.key && req.query.key !== processing.webhookKey) {
    return res.status(403).send('Mauvaise clé de déclenchement')
  } else {
    const sessionState = await session.reqAuthenticated(req)
    if (!['admin', 'exec'].includes(permissions.getUserResourceProfile(processing.owner, processing.permissions, sessionState) ?? '')) return res.status(403).send()
  }
  if (!processing.active) return res.status(409).send('Le traitement n\'est pas actif')
  res.send(await createNext(mongo.db, locks, processing, true, req.query.delay ? Number(req.query.delay) : 0))
})
