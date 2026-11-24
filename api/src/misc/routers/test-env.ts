import express from 'express'
import fs from 'fs-extra'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import mongo from '#mongo'
import config from '#config'

// Mounted in development only (app.ts): the Playwright test suite resets and inspects state on the running dev API.
const router = express.Router()

// Prefixed test sub-spaces: a test suite owns the accounts whose ids start with its own prefix (test_<suite>_)
// and the data they own, cleaned without touching the other suites nor the unprefixed accounts
const testPrefixRegexp = /^test_[a-z0-9]+(?:_[a-z0-9]+)*_$/
const validPrefix = (req: express.Request) => {
  const prefix = req.query.prefix
  return typeof prefix === 'string' && testPrefixRegexp.test(prefix) ? prefix : undefined
}
// the prefix only holds [a-z0-9_], safe in a regexp
const ownerFilter = (prefix: string) => ({ 'owner.id': { $regex: new RegExp('^' + prefix) } })

// Cleanup of a sub-space (DELETE /?prefix=test_<suite>_): the processings and runs owned by its accounts, their
// limits, and the worker locks of those processings. Nothing else: the other sub-spaces and the unprefixed accounts
// keep their data, the worker keeps its other locks.
router.delete('/', async (req, res, next) => {
  try {
    const prefix = validPrefix(req)
    if (!prefix) return res.status(400).type('text/plain').send('invalid test prefix')
    const filter = ownerFilter(prefix)
    // the worker locks a run by the id of its processing
    const processingIds = (await mongo.processings.find(filter).project<{ _id: string }>({ _id: 1 }).toArray()).map(p => p._id)
    await Promise.all([
      mongo.processings.deleteMany(filter),
      mongo.runs.deleteMany(filter),
      mongo.limits.deleteMany({ id: { $regex: new RegExp('^' + prefix) } }),
      mongo.db.collection<{ _id: string }>('locks').deleteMany({ _id: { $in: processingIds } })
    ])
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// The runs of a sub-space that are not yet completed (GET /pending-tasks?prefix=test_<suite>_, used by its tests to
// wait for the worker to be idle): the runs of the other sub-spaces are not theirs to wait for
router.get('/pending-tasks', async (req, res, next) => {
  try {
    const prefix = validPrefix(req)
    if (!prefix) return res.status(400).type('text/plain').send('invalid test prefix')
    const runs = await mongo.runs.find(
      { ...ownerFilter(prefix), status: { $in: ['triggered', 'scheduled', 'running'] } },
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
// plugin to a value that doesn't resolve in the registry).
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

// The runtime overrides below change the whole API process, for every sub-space: they only answer a test run of this
// checkout's own suite (test_processings_). Two conditions, both checked on each call:
// - a direct call, not through the reverse proxy (no X-Forwarded-Host): the suite calls the API on its private port,
//   the world loader, the browsers and the other suites of a shared environment go through the proxy;
// - the stateful lock of this checkout's suite is held by a live test run (tests/support/stateful-lock.ts, taken by
//   its state-setup project and released by its teardown).
const statefulLockPath = path.resolve(import.meta.dirname, '../../../../dev/logs/stateful-tests.lock')
const ownTestRunOnly: express.RequestHandler = (req, res, next) => {
  if (req.get('x-forwarded-host')) return res.status(403).type('text/plain').send('direct calls only')
  let holder = 0
  try {
    holder = parseInt(readFileSync(statefulLockPath, 'utf8'), 10)
  } catch {}
  let alive = false
  if (holder) {
    try {
      process.kill(holder, 0)
      alive = true
    } catch (err: any) {
      alive = err?.code === 'EPERM'
    }
  }
  if (!alive) return res.status(403).type('text/plain').send('only during a test run of this checkout')
  next()
}

// Set an environment variable in the main process (for testing)
router.post('/set-env', ownTestRunOnly, (req, res, next) => {
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
router.post('/set-config', ownTestRunOnly, (req, res, next) => {
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

// Documents written as is in one of the collections of the sub-space clean, and read back: the test of the clean
// owns nested sub-spaces whose accounts do not exist in simple-directory.
const docsCollections = ['processings', 'runs', 'limits', 'locks']
router.post('/docs/:collection', async (req, res, next) => {
  try {
    if (!docsCollections.includes(req.params.collection)) return res.status(400).send('unknown collection')
    await mongo.db.collection(req.params.collection).insertOne(req.body)
    res.status(201).send()
  } catch (err) {
    next(err)
  }
})
router.get('/docs/:collection/:id', async (req, res, next) => {
  try {
    if (!docsCollections.includes(req.params.collection)) return res.status(400).send('unknown collection')
    const doc = await mongo.db.collection<{ _id: string }>(req.params.collection).findOne({ _id: req.params.id })
    if (!doc) return res.status(404).send()
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

// The data-fair API key of the worker in development: the test setup creates it through data-fair's API and hands it
// over here, the worker reads it from this database before each run (worker/src/utils/data-fair-api-key.ts).
router.put('/data-fair-api-key', async (req, res, next) => {
  try {
    const key = req.body?.key
    if (typeof key !== 'string' || !key) return res.status(400).send('key is required')
    await mongo.db.collection<{ _id: string, key: string }>('test-env')
      .updateOne({ _id: 'data-fair-api-key' }, { $set: { key } }, { upsert: true })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// Remove the installed plugins of a sub-space (DELETE /plugins?prefix=test_<suite>_): the entries of the legacy plugins
// directory named after its plugins (`@test_<suite>_…`), the others stay. No-op when the legacy plugins volume isn't
// mounted (config.dataDir unset).
router.delete('/plugins', async (req, res, next) => {
  try {
    const prefix = validPrefix(req)
    if (!prefix) return res.status(400).type('text/plain').send('invalid test prefix')
    if (config.dataDir) {
      const pluginsDir = path.resolve(config.dataDir, 'plugins')
      const entries = await fs.pathExists(pluginsDir) ? await fs.readdir(pluginsDir) : []
      for (const entry of entries.filter(e => e.startsWith('@' + prefix))) {
        await fs.remove(path.join(pluginsDir, entry))
      }
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
