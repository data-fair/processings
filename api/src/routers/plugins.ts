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

import { session } from '@data-fair/lib-express/index.js'
import mongo from '#mongo'
import config from '#config'
import permissions from '../utils/permissions.ts'

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

const pluginMetadataSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      title: 'Nom du plugin',
      layout: {
        cols: 4
      }
    },
    category: {
      type: 'string',
      title: 'Catégorie',
      layout: {
        cols: 4
      }
    },
    icon: {
      type: 'string',
      title: 'Icon',
      layout: {
        getItems: {
          url: 'https://koumoul.com/data-fair/api/v1/datasets/icons-mdi-latest/lines?q={q}&size=10000',
          itemsResults: 'data.results',
          itemTitle: 'item.name',
          itemValue: 'item.svgPath',
          itemIcon: 'item.svg'
        },
        cols: 4
      }
    },
    description: {
      type: 'string',
      title: 'Description du plugin'
    }
  }
}

// Install a new plugin or update an existing one
router.post('/', permissions.isSuperAdmin, async (req, res) => {
  const { body } = (await import('#doc/plugin/post-req/index.ts')).returnValid(req)
  const plugin = body as Record<string, any>
  plugin.id = plugin.name.replace('/', '-') + '-' + semver.major(plugin.version)
  if (plugin.distTag !== 'latest') plugin.id += '-' + plugin.distTag

  const pluginDir = path.join(pluginsDir, plugin.id)
  const dir = await tmp.dir({ unsafeCleanup: true, tmpdir: tmpDir, prefix: 'plugin-install-' })

  try {
    // create a pseudo npm package with a dependency to the plugin referenced from the registry
    await fs.writeFile(path.join(dir.path, 'package.json'), JSON.stringify({
      name: plugin.id.replace('@', ''),
      type: 'module',
      dependencies: {
        [plugin.name]: '^' + plugin.version
      }
    }, null, 2))
    await exec('npm install --omit=dev', { cwd: dir.path })

    // move the plugin to the src directory (Stripping types is currently unsupported for files under node_modules)
    await fs.move(path.join(dir.path, 'node_modules', plugin.name), path.join(dir.path, 'src'), { overwrite: true })

    // generate an index.js file to export the main file
    const mainFile = (await fs.readJson(path.join(dir.path, 'src', 'package.json'))).main || 'index.js'
    await fs.writeFile(path.join(dir.path, 'index.js'), `export * from './${path.join('src', mainFile)}'`)

    plugin.pluginConfigSchema = await fs.readJson(path.join(dir.path, 'src', 'plugin-config-schema.json'))
    plugin.processingConfigSchema = await fs.readJson(path.join(dir.path, 'src', 'processing-config-schema.json'))

    // static metadata for the plugin
    await fs.writeFile(path.join(dir.path, 'plugin.json'), JSON.stringify(plugin, null, 2))
    await fs.move(dir.path, pluginDir, { overwrite: true })
  } finally {
    try {
      await dir.cleanup()
    } catch (err) {
      // ignore, directory was moved
    }
  }

  // set defaults access (don't overwrite if already exists (after an update))
  plugin.access = { public: false, privateAccess: [] }
  const accessFilePath = path.join(pluginsDir, plugin.id + '-access.json')
  if (!await fs.pathExists(accessFilePath)) await fs.writeJson(accessFilePath, plugin.access)

  // return the existing config if it exists
  const pluginConfigPath = path.join(pluginsDir, plugin.id + '-config.json')
  if (await fs.pathExists(pluginConfigPath)) plugin.config = await fs.readJson(pluginConfigPath)

  // return the existing metadata if it exists
  const pluginMetadataPath = path.join(pluginsDir, plugin.id + '-metadata.json')
  if (await fs.pathExists(pluginMetadataPath)) plugin.metadata = await fs.readJson(pluginMetadataPath)

  res.send(plugin)
})

// List installed plugins (optional: privateAccess=[type]:[id])
router.get('/', async (req, res) => {
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

    const pluginMetadataPath = path.join(pluginsDir, dir + '-metadata.json')
    const version = pluginInfo.distTag === 'latest' ? pluginInfo.version : `${pluginInfo.distTag} - ${pluginInfo.version}`
    pluginInfo.metadata = {
      name: pluginInfo.name.replace('@data-fair/processing-', '') + ' (' + version + ')',
      description: pluginInfo.description,
      ...(await fs.pathExists(pluginMetadataPath) ? await fs.readJson(pluginMetadataPath) : {})
    }
    pluginInfo.pluginMetadataSchema = pluginMetadataSchema

    results.push(pluginInfo)
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
})

// Return PluginData (if connected)
router.get('/:id', async (req, res) => {
  await session.reqAuthenticated(req)
  try {
    const pluginInfo: Plugin = await fs.readJson(resolvePath(pluginsDir, path.join(req.params.id, 'plugin.json')))
    const pluginMetadataPath = path.join(pluginsDir, req.params.id + '-metadata.json')
    const version = pluginInfo.distTag === 'latest' ? pluginInfo.version : `${pluginInfo.distTag} - ${pluginInfo.version}`
    pluginInfo.metadata = {
      name: pluginInfo.name.replace('@data-fair/processing-', '') + ' (' + version + ')',
      description: pluginInfo.description,
      ...(await fs.pathExists(pluginMetadataPath) ? await fs.readJson(pluginMetadataPath) : {})
    }
    res.send(pluginInfo)
  } catch (e: any) {
    if (e.code === 'ENOENT') res.status(404).send('Plugin not found')
    else throw e
  }
})

router.delete('/:id', permissions.isSuperAdmin, async (req, res) => {
  await fs.remove(path.join(pluginsDir, req.params.id))
  await fs.remove(path.join(pluginsDir, req.params.id + '-config.json'))
  await fs.remove(path.join(pluginsDir, req.params.id + '-access.json'))
  res.status(204).send()
})

router.put('/:id/config', permissions.isSuperAdmin, async (req, res) => {
  const { pluginConfigSchema } = await fs.readJson(path.join(pluginsDir, req.params.id, 'plugin.json'))
  const validate = ajv.compile(pluginConfigSchema)
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-config.json'), req.body)
  res.send(req.body)
})

router.put('/:id/metadata', permissions.isSuperAdmin, async (req, res) => {
  const validate = ajv.compile(pluginMetadataSchema)
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-metadata.json'), req.body)
  res.send(req.body)
})

router.put('/:id/access', permissions.isSuperAdmin, async (req, res) => {
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-access.json'), req.body)
  res.send(req.body)
})
