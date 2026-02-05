import type { Plugin } from '#types/plugin/index.ts'

import { exec } from 'child_process'
import { promisify } from 'util'
import { Router } from 'express'
import Ajv from 'ajv'
import ajvFormats from 'ajv-formats'
import fs from 'fs-extra'
import path from 'path'
import semver from 'semver'
import resolvePath from 'resolve-path'
import tmp from 'tmp-promise'
import multer from 'multer'

import { session, httpError } from '@data-fair/lib-express'
import mongo from '#mongo'
import config from '#config'
import permissions from '../misc/utils/permissions.ts'

// @ts-ignore
const ajv = ajvFormats(new Ajv({ strict: false }))
const execAsync = promisify(exec)

const router = Router()
export default router

const pluginsDir = path.resolve(config.dataDir, 'plugins')
fs.ensureDirSync(pluginsDir)
const tmpDir = config.tmpDir || path.resolve(config.dataDir, 'tmp')
fs.ensureDirSync(tmpDir)

tmp.setGracefulCleanup()

/**
 * Multer configuration for handling file uploads.
 * It stores files directly in the temporary directory and only allows .tgz files.
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, tmpDir)
    },
    filename: (req, file, cb) => {
      cb(null, `plugin-${Date.now()}-${file.originalname}`)
    }
  }),
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) === '.tgz') cb(null, true)
    else cb(httpError(400, 'Only .tgz files are allowed'))
  },
  limits: { fileSize: 1 * 1024 * 1024 } // 1MB max
})

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
      enum: config.pluginCategories,
      layout: {
        cols: 4
      }
    },
    icon: {
      type: 'object',
      title: 'Icon',
      layout: {
        getItems: {
          url: 'https://koumoul.com/data-fair/api/v1/datasets/icons-mdi-latest/lines?q={q}&select=name,svg,svgPath&size=25',
          itemsResults: 'data.results',
          itemTitle: 'item.name',
          itemIcon: 'item.svg',
          itemKey: 'item.name'
        },
        cols: 4
      }
    },
    documentation: {
      type: 'string',
      title: 'Documentation',
      description: 'URL de la page du tutoriel du plugin',
      format: 'uri',
      errorMessage: 'Dois être une URL valide',
    },
    description: {
      type: 'string',
      title: 'Description du plugin'
    }
  }
}

// Install a new plugin or update an existing one
router.post('/', upload.single('file'), permissions.isSuperAdmin, async (req, res) => {
  const dir = await tmp.dir({ unsafeCleanup: true, tmpdir: tmpDir, prefix: 'plugin-install-' })
  let id: string
  let tarballPath: string
  let plugin: Partial<Plugin>

  try {
    let distTag = 'latest'
    if (req.file) { // File upload mode - use the uploaded .tgz file
      tarballPath = req.file.path
    } else { // NPM mode - validate body and download from npm
      const { body } = (await import('#doc/plugin/post-req/index.ts')).returnValid(req)

      // download the plugin package using npm pack
      const { stdout } = await execAsync(`npm pack ${body.name}@${body.version}`, { cwd: dir.path })
      tarballPath = path.join(dir.path, stdout.trim())
      if (body.distTag !== 'latest') distTag = body.distTag
    }

    // extract the tarball
    await execAsync(`tar -xzf "${tarballPath}" -C "${dir.path}"`)
    const extractedPath = path.join(dir.path, 'package')

    // install dependencies of the plugin
    await execAsync('npm install --omit=dev', { cwd: extractedPath })

    // generate plugin.json from package.json
    const packageJson = await fs.readJson(path.join(extractedPath, 'package.json'))
    id = packageJson.name.replace('/', '-') + '-' + semver.major(packageJson.version)
    if (distTag !== 'latest') id += '-' + distTag

    plugin = {
      id,
      name: packageJson.name,
      description: packageJson.description,
      version: packageJson.version,
      distTag
    }

    // read plugin schemas
    plugin.pluginConfigSchema = await fs.readJson(path.join(extractedPath, 'plugin-config-schema.json'))
    plugin.processingConfigSchema = await fs.readJson(path.join(extractedPath, 'processing-config-schema.json'))

    // static metadata for the plugin
    await fs.writeFile(
      path.join(extractedPath, 'plugin.json'),
      JSON.stringify(plugin, null, 2)
    )

    // Create index.js if it doesn't exist and redirects to the main file
    if (!await fs.pathExists(path.join(extractedPath, 'index.js'))) {
      await fs.writeFile(path.join(extractedPath, 'index.js'), `export * from './${packageJson.main}'`)
    }

    // move the extracted plugin to the final destination
    await fs.move(extractedPath, path.join(pluginsDir, id), { overwrite: true })
    await dir.cleanup()
    if (req.file) await fs.remove(req.file.path)
  } catch (error: any) {
    await dir.cleanup()
    if (req.file) await fs.remove(req.file.path)
    throw httpError(400, `Failed to install plugin: ${error.message || error}`)
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
        throw httpError(403, 'privateAccess does not match current account')
      }
      if (!access.public && !access.privateAccess.find((p: any) => p.type === type && p.id === id)) {
        continue // pass to next plugin
      }
    } else {
      throw httpError(400, 'privateAccess filter is required')
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
  if (!req.params.id) throw httpError(400, 'Plugin ID is required')
  if (!fs.existsSync(path.join(pluginsDir, req.params.id))) throw httpError(404, 'Plugin not found')

  await fs.remove(path.join(pluginsDir, req.params.id))
  await fs.remove(path.join(pluginsDir, req.params.id + '-config.json'))
  await fs.remove(path.join(pluginsDir, req.params.id + '-access.json'))
  res.status(204).send()
})

router.put('/:id/config', permissions.isSuperAdmin, async (req, res) => {
  const pluginPath = path.join(pluginsDir, req.params.id, 'plugin.json')
  if (!await fs.pathExists(pluginPath)) {
    throw httpError(404, 'Plugin not found')
  }

  const { pluginConfigSchema } = await fs.readJson(pluginPath)
  const validate = ajv.compile(pluginConfigSchema)
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-config.json'), req.body)
  res.send(req.body)
})

router.put('/:id/metadata', permissions.isSuperAdmin, async (req, res) => {
  if (!await fs.pathExists(path.join(pluginsDir, req.params.id, 'plugin.json'))) {
    throw httpError(404, 'Plugin not found')
  }

  const validate = ajv.compile(pluginMetadataSchema)
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-metadata.json'), req.body)
  res.send(req.body)
})

router.put('/:id/access', permissions.isSuperAdmin, async (req, res) => {
  if (!await fs.pathExists(path.join(pluginsDir, req.params.id, 'plugin.json'))) {
    throw httpError(404, 'Plugin not found')
  }

  await fs.writeJson(path.join(pluginsDir, req.params.id + '-access.json'), req.body)
  res.send(req.body)
})
