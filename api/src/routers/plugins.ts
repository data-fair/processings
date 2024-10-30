import type { Plugin } from '#types/plugin/index.ts'

import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { Router } from 'express'
import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'
import fs from 'fs-extra'
import path from 'path'
import semver from 'semver'
import resolvePath from 'resolve-path'
import tmp from 'tmp-promise'

import { session, asyncHandler } from '@data-fair/lib-express/index.js'
import mongo from '#mongo'
import config from '#config'
import permissions from '../utils/permissions.js'

// @ts-ignore
const ajv = ajvFormats(new Ajv({ strict: false }))
const exec = promisify(execCallback)

const router = Router()
export default router

fs.ensureDirSync(config.dataDir)
const pluginsDir = path.resolve(config.dataDir, 'plugins')
fs.ensureDirSync(pluginsDir)
const tmpDir = config.tmpDir || path.resolve(config.dataDir, 'tmp')
fs.ensureDirSync(tmpDir)

tmp.setGracefulCleanup()

/**
 * For compatibility with old plugins
 */
const injectPluginNameConfig = (plugin: Plugin): Plugin => {
  if (!plugin.pluginConfigSchema.properties?.pluginName) {
    const version = plugin.distTag === 'latest' ? plugin.version : `${plugin.distTag} - ${plugin.version}`
    const defaultName = plugin.name.replace('@data-fair/processing-', '') + ' (' + version + ')'
    plugin.pluginConfigSchema.properties = plugin.pluginConfigSchema.properties || {}
    plugin.pluginConfigSchema.properties.pluginName = {
      type: 'string',
      title: 'Nom du plugin',
      description: 'Nom du plugin affiché dans les traitements',
      default: defaultName
    }
  }
  return plugin
}

const preparePluginInfo = async (pluginInfo: Plugin): Promise<Plugin> => {
  pluginInfo = injectPluginNameConfig(pluginInfo)
  const pluginConfigPath = path.join(pluginsDir, pluginInfo.id + '-config.json')
  let customName = await fs.pathExists(pluginConfigPath) ? (await fs.readJson(pluginConfigPath)).pluginName : pluginInfo.pluginConfigSchema.properties.pluginName.default
  if (!customName) customName = pluginInfo.name.replace('@data-fair/processing-', '') + ' (' + pluginInfo.distTag + ' - ' + pluginInfo.version + ')'
  return { ...pluginInfo, customName }
}

router.post('/', permissions.isSuperAdmin, asyncHandler(async (req, res) => {
  const plugin: Plugin = (await import ('#types/plugin/index.ts')).returnValid(req.body)
  plugin.id = plugin.name.replace('/', '-') + '-' + semver.major(plugin.version)
  if (plugin.distTag !== 'latest') plugin.id += '-' + plugin.distTag

  const pluginDir = path.join(pluginsDir, plugin.id)
  const dir = await tmp.dir({ unsafeCleanup: true, tmpdir: tmpDir, prefix: 'plugin-install-' })

  try {
    // create a pseudo npm package with a dependency to the plugin referenced from the registry
    await fs.writeFile(path.join(dir.path, 'package.json'), JSON.stringify({
      name: plugin.id.replace('@', ''),
      dependencies: {
        [plugin.name]: '^' + plugin.version
      }
    }, null, 2))
    await exec('npm install --omit=dev', { cwd: dir.path })
    await fs.writeFile(path.join(dir.path, 'index.js'), `module.exports = require('${plugin.name}')`)
    plugin.pluginConfigSchema = await fs.readJson(path.join(dir.path, 'node_modules', plugin.name, 'plugin-config-schema.json'))
    plugin.processingConfigSchema = await fs.readJson(path.join(dir.path, 'node_modules', plugin.name, 'processing-config-schema.json'))
    await fs.writeFile(path.join(dir.path, 'plugin.json'), JSON.stringify(plugin, null, 2))
    await fs.move(dir.path, pluginDir, { overwrite: true })
  } finally {
    try {
      await dir.cleanup()
    } catch (err) {
      // ignore, directory was moved
    }
  }

  const installedPlugin: Plugin = await preparePluginInfo(plugin)
  installedPlugin.access = { public: false, privateAccess: [] }
  const accessFilePath = path.join(pluginsDir, installedPlugin.id + '-access.json')
  if (!await fs.pathExists(accessFilePath)) await fs.writeJson(accessFilePath, installedPlugin.access)
  const pluginConfigPath = path.join(pluginsDir, installedPlugin.id + '-config.json')
  if (await fs.pathExists(pluginConfigPath)) installedPlugin.config = await fs.readJson(pluginConfigPath)

  res.send(installedPlugin)
}))

// List installed plugins (optional: privateAccess=[type]:[id])
router.get('/', asyncHandler(async (req, res) => {
  const sessionState = await session.reqAuthenticated(req)

  const dirs = (await fs.readdir(pluginsDir)).filter(p => !p.endsWith('.json'))
  const results: Plugin[] = []
  for (const dir of dirs) {
    const pluginInfo: Plugin = await fs.readJson(path.join(pluginsDir, dir, 'plugin.json'))

    let access = { public: false, privateAccess: [] }
    const accessFilePath = path.join(pluginsDir, dir + '-access.json')
    if (await fs.pathExists(accessFilePath)) {
      access = await fs.readJson(path.join(pluginsDir, dir + '-access.json'))
    }

    if (sessionState.user.adminMode) {
      const pluginConfigPath = path.join(pluginsDir, dir + '-config.json')
      if (await fs.pathExists(pluginConfigPath)) pluginInfo.config = await fs.readJson(pluginConfigPath)
      pluginInfo.access = access
    } else if (req.query.privateAccess && typeof req.query.privateAccess === 'string') {
      const [type, id] = req.query.privateAccess.split(':')
      if (type !== sessionState.account.type || id !== sessionState.account.id) {
        return res.status(403).send('privateAccess does not match current account')
      }
      if (!access.public && !access.privateAccess.find((p: any) => p.type === type && p.id === id)) {
        continue // pass to next plugin
      }
    } else {
      return res.status(400).send('privateAccess filter is required')
    }
    results.push(await preparePluginInfo(pluginInfo))
  }

  const aggregationResult = (
    await mongo.processings
      .aggregate([{ $group: { _id: '$plugin', count: { $sum: 1 } } }])
      .toArray()
  ).reduce((acc:any, { _id, count }: any) => {
    acc[_id] = count
    return acc
  }, {})

  res.send({
    count: results.length,
    results,
    facets: { usages: aggregationResult || {} }
  })
}))

// Return PluginData (if connected)
router.get('/:id', asyncHandler(async (req, res) => {
  await session.reqAuthenticated(req)
  try {
    const pluginInfo: Plugin = await fs.readJson(resolvePath(pluginsDir, path.join(req.params.id, 'plugin.json')))
    res.send(await preparePluginInfo(pluginInfo))
  } catch (e: any) {
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
