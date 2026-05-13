import express from 'express'
import fs from 'fs-extra'
import path from 'node:path'
import mongo from '#mongo'
import config from '#config'

const router = express.Router()

// Cleanup test_* owned data from mongo + plugins on disk
router.delete('/', async (req, res, next) => {
  try {
    const testOwnerFilter = { 'owner.id': { $regex: /^test_/ } }
    const testIdFilter = { id: { $regex: /^test_/ } }

    await Promise.all([
      mongo.processings.deleteMany(testOwnerFilter),
      mongo.runs.deleteMany(testOwnerFilter),
      mongo.limits.deleteMany(testIdFilter),
      mongo.db.collection('locks').deleteMany({})
    ])

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Return the list of runs that are not yet completed (used by tests to wait for worker idle)
router.get('/pending-tasks', async (req, res, next) => {
  try {
    const runs = await mongo.runs.find(
      { status: { $in: ['triggered', 'scheduled', 'running'] } },
      { projection: { _id: 1, status: 1, 'processing._id': 1, 'processing.title': 1 } }
    ).toArray()
    const grouped: Record<string, any[]> = { triggered: [], scheduled: [], running: [] }
    for (const run of runs) grouped[run.status].push(run)
    res.json(grouped)
  } catch (err) {
    next(err)
  }
})

// Return the raw MongoDB document for a processing
router.get('/raw-processing/:id', async (req, res, next) => {
  try {
    const processing = await mongo.processings.findOne({ _id: req.params.id })
    if (!processing) return res.status(404).json({ error: 'processing not found' })
    res.json(processing)
  } catch (err) {
    next(err)
  }
})

// Patch a processing document without validation (used by tests to put a
// processing into states that the normal API guards prevent, e.g. setting
// pluginId to a value that doesn't resolve in the registry).
router.patch('/raw-processing/:id', async (req, res, next) => {
  try {
    const result = await mongo.processings.updateOne(
      { _id: req.params.id },
      { $set: req.body }
    )
    if (result.matchedCount === 0) return res.status(404).json({ error: 'processing not found' })
    const processing = await mongo.processings.findOne({ _id: req.params.id })
    res.json(processing)
  } catch (err) {
    next(err)
  }
})

// Return the raw MongoDB document for a run
router.get('/raw-run/:id', async (req, res, next) => {
  try {
    const run = await mongo.runs.findOne({ _id: req.params.id })
    if (!run) return res.status(404).json({ error: 'run not found' })
    res.json(run)
  } catch (err) {
    next(err)
  }
})

// Set an environment variable in the main process (for testing)
router.post('/set-env', (req, res, next) => {
  try {
    const { key, value } = req.body
    if (value === undefined || value === null) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Set a config value at runtime (for testing)
router.post('/set-config', (req, res, next) => {
  try {
    const { path: configPath, value } = req.body
    const parts = configPath.split('.')
    let obj: any = config
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]]
    }
    obj[parts[parts.length - 1]] = value
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Wipe the installed plugins directory (used between test runs).
// No-op when the legacy plugins volume isn't mounted (config.dataDir unset).
router.delete('/plugins', async (req, res, next) => {
  try {
    if (config.dataDir) {
      const pluginsDir = path.resolve(config.dataDir, 'plugins')
      await fs.emptyDir(pluginsDir)
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
