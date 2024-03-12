import { session, asyncHandler } from '@data-fair/lib/express/index.js'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { Router } from 'express'
import config from '../config.js'
import permissions from '../utils/permissions.js'
import Ajv from 'ajv'
import fs from 'fs-extra'
import path from 'path'
import resolvePath from 'resolve-path'
import semver from 'semver'
import tmp from 'tmp-promise'

// @ts-ignore
const ajv = new Ajv({ strict: false })
const exec = promisify(execCallback)

const router = Router()
export default router

const pluginsDir = path.join(config.dataDir, 'plugins')
fs.ensureDirSync(pluginsDir)
const tmpDir = config.tmpDir || path.join(config.dataDir, 'tmp')
fs.ensureDirSync(tmpDir)

/**
 * @typedef {Object} PluginInfo
 * @property {string} name
 * @property {string} fullName
 * @property {string} version
 * @property {string} distTag
 * @property {string} description
 * @property {string} npm
 * @property {Object} config
 * @property {Object} access
 */

/**
 * @param {PluginInfo} pluginInfo
 * @returns {PluginInfo}
 */
const preparePluginInfo = (pluginInfo) => {
  const version = pluginInfo.distTag === 'latest' ? pluginInfo.version : `${pluginInfo.distTag} - ${pluginInfo.version}`
  return { ...pluginInfo, fullName: `${pluginInfo.name.replace('@data-fair/processing-', '')} (${version})` }
}

// prepare the plugin in a subdirectory
router.post('/', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  await session.reqAuthenticated(req)

  const plugin = req.body
  plugin.id = plugin.name.replace('/', '-') + '-' + semver.major(plugin.version)
  if (plugin.distTag !== 'latest') plugin.id += '-' + plugin.distTag
  const pluginDir = path.join(pluginsDir, plugin.id)
  const dir = await tmp.dir({ unsafeCleanup: true, dir: tmpDir })
  try {
    // create a pseudo npm package with a dependency to the plugin referenced from the registry
    await fs.writeFile(path.join(dir.path, 'package.json'), JSON.stringify({
      name: plugin.id.replace('@', ''),
      dependencies: {
        [plugin.name]: '^' + plugin.version
      }
    }, null, 2))
    await exec('npm install --only=prod', { cwd: dir.path })
    await fs.writeFile(path.join(dir.path, 'index.js'), `module.exports = require('${plugin.name}')`)
    plugin.pluginConfigSchema = await fs.readJson(path.join(dir.path, 'node_modules', plugin.name, 'plugin-config-schema.json'))
    plugin.processingConfigSchema = await fs.readJson(path.join(dir.path, 'node_modules', plugin.name, 'processing-config-schema.json'))
    await fs.writeFile(path.join(dir.path, 'plugin.json'), JSON.stringify(plugin, null, 2))
    await fs.move(dir.path, pluginDir, { overwrite: true })
  } finally {
    await dir.cleanup()
  }
  res.send(plugin)
}))

router.get('/', asyncHandler(async (req, res) => {
  const reqSession = await session.reqAuthenticated(req)

  const dirs = (await fs.readdir(pluginsDir)).filter(p => !p.endsWith('.json'))
  const results = []
  for (const dir of dirs) {
    /** @type {PluginInfo} */
    const pluginInfo = await fs.readJson(path.join(pluginsDir, dir, 'plugin.json'))
    const access = await fs.pathExists(path.join(pluginsDir, dir + '-access.json')) ? await fs.readJson(path.join(pluginsDir, dir + '-access.json')) : { public: false, privateAccess: [] }
    if (reqSession.user.adminMode) {
      if (await fs.pathExists(path.join(pluginsDir, dir + '-config.json'))) {
        pluginInfo.config = await fs.readJson(path.join(pluginsDir, dir + '-config.json'))
      }
      pluginInfo.access = access
    }
    if (req.query.privateAccess) {
      const [type, id] = req.query.privateAccess.split(':')
      if (!reqSession.user.adminMode && (type !== reqSession.account.type || id !== reqSession.account.id)) {
        return res.status(403).send('privateAccess does not match current account')
      }
      if (!access.public && !access.privateAccess.find((/** @type {any} */p) => p.type === type && p.id === id)) {
        continue
      }
    } else if (!reqSession.user.adminMode) {
      return res.status(400).send('privateAccess filter is required')
    }
    results.push(preparePluginInfo(pluginInfo))
  }
  res.send({
    count: results.length,
    results
  })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  await session.reqAuthenticated(req)
  /** @type {PluginInfo} */
  const pluginInfo = await fs.readJson(resolvePath(pluginsDir, path.join(req.params.id, 'plugin.json')))
  res.send(preparePluginInfo(pluginInfo))
}))

router.delete('/:id', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  await session.reqAuthenticated(req)
  await fs.remove(path.join(pluginsDir, req.params.id))
  await fs.remove(path.join(pluginsDir, req.params.id + '-config.json'))
  await fs.remove(path.join(pluginsDir, req.params.id + '-access.json'))
  res.status(204).send()
}))

router.put('/:id/config', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  await session.reqAuthenticated(req)
  const { pluginConfigSchema } = await fs.readJson(path.join(pluginsDir, req.params.id, 'plugin.json'))
  const validate = ajv.compile(pluginConfigSchema)
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-config.json'), req.body)
  res.send(req.body)
}))

router.put('/:id/access', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  await session.reqAuthenticated(req)
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-access.json'), req.body)
  res.send(req.body)
}))
