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
 * @typedef {Object} PluginData
 * @property {string} name
 * @property {string} customName - the name defined by config
 * @property {string} description
 * @property {string} version
 * @property {string} distTag
 * @property {string} id
 * @property {any} pluginConfigSchema
 * @property {any} processingConfigSchema
 */

/**
 * @typedef {Object} PluginDataWithConfig
 * @property {string} name
 * @property {string} customName - the name defined by config
 * @property {string} description
 * @property {string} version
 * @property {string} distTag
 * @property {string} id
 * @property {any} pluginConfigSchema
 * @property {any} processingConfigSchema
 * @property {Object} config
 * @property {Object} access
 */

/**
 * For compatibility with old plugins
 * @param {PluginData} plugin
 * @returns {PluginData}
 */
const injectPluginNameConfig = (plugin) => {
  if (!plugin.pluginConfigSchema.properties.pluginName) {
    const version = plugin.distTag === 'latest' ? plugin.version : `${plugin.distTag} - ${plugin.version}`
    const defaultName = plugin.name.replace('@data-fair/processing-', '') + ' (' + version + ')'
    plugin.pluginConfigSchema.properties.pluginName = {
      type: 'string',
      title: 'Nom du plugin',
      description: 'Nom du plugin affiché dans les traitements',
      default: defaultName
    }
  }
  return plugin
}

/**
 * @param {PluginData | PluginDataWithConfig} pluginInfo
 * @returns {Promise<PluginData | PluginDataWithConfig>}
 */
const preparePluginInfo = async (pluginInfo) => {
  pluginInfo = injectPluginNameConfig(pluginInfo)
  const pluginConfigPath = path.join(pluginsDir, pluginInfo.id + '-config.json')
  const customName = await fs.pathExists(pluginConfigPath) ? (await fs.readJson(pluginConfigPath)).pluginName : pluginInfo.pluginConfigSchema.properties.pluginName.default
  return { ...pluginInfo, customName }
}

/**
 * Install a plugin - SuperAdmin only
 *
 * @param {import('express').Request} req
 * req.body: { name: string, description: string, version: string, distTag: string }
 * @param {import('express').Response} res
 */
router.post('/', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  /** @type {PluginData} */
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

  const installedPlugin = /** @type {PluginDataWithConfig} */(await preparePluginInfo(plugin))
  installedPlugin.access = { public: false, privateAccess: [] }
  await fs.writeJson(path.join(pluginsDir, plugin.id + '-access.json'), installedPlugin.access)

  res.send(installedPlugin)
}))

// List installed plugins (optional: privateAccess=[type]:[id)
router.get('/', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)

  const dirs = (await fs.readdir(pluginsDir)).filter(p => !p.endsWith('.json'))
  const results = []
  for (const dir of dirs) {
    /** @type {PluginDataWithConfig} */
    const pluginInfo = await fs.readJson(path.join(pluginsDir, dir, 'plugin.json'))
    const access = await fs.readJson(path.join(pluginsDir, dir + '-access.json'))

    if (sessionState.user.adminMode) {
      const pluginConfigPath = path.join(pluginsDir, dir + '-config.json')
      if (await fs.pathExists(pluginConfigPath)) pluginInfo.config = await fs.readJson(pluginConfigPath)
      pluginInfo.access = access
    } else if (req.query.privateAccess && typeof req.query.privateAccess === 'string') {
      const [type, id] = req.query.privateAccess.split(':')
      if (type !== sessionState.account.type || id !== sessionState.account.id) {
        return res.status(403).send('privateAccess does not match current account')
      }
      if (!access.public && !access.privateAccess.find((/** @type {{type: string, id: string}} */p) => p.type === type && p.id === id)) {
        continue // pass to next plugin
      }
    } else {
      return res.status(400).send('privateAccess filter is required')
    }
    results.push(await preparePluginInfo(pluginInfo))
  }
  res.send({
    count: results.length,
    results
  })
}))

// Return PluginData (if connected)
router.get('/:id', asyncHandler(async (req, res) => {
  await session.reqAuthenticated(req)
  try {
    /** @type {PluginData} */
    const pluginInfo = await fs.readJson(resolvePath(pluginsDir, path.join(req.params.id, 'plugin.json')))
    res.send(await preparePluginInfo(pluginInfo))
  } catch (/** @type {any} */ e) {
    if (e.code === 'ENOENT') res.status(404).send('Plugin not found')
    else throw e
  }
}))

router.delete('/:id', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  await fs.remove(path.join(pluginsDir, req.params.id))
  await fs.remove(path.join(pluginsDir, req.params.id + '-config.json'))
  await fs.remove(path.join(pluginsDir, req.params.id + '-access.json'))
  res.status(204).send()
}))

router.put('/:id/config', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  const { pluginConfigSchema } = await fs.readJson(path.join(pluginsDir, req.params.id, 'plugin.json'))
  const validate = ajv.compile(pluginConfigSchema)
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-config.json'), req.body)
  res.send(req.body)
}))

router.put('/:id/access', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-access.json'), req.body)
  res.send(req.body)
}))
