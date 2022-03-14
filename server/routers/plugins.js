const semver = require('semver')
const config = require('config')
const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const tmp = require('tmp-promise')
const ajv = require('ajv')()
const asyncWrap = require('../utils/async-wrap')
const permissions = require('../utils/permissions')
const session = require('../utils/session')

const router = module.exports = express.Router()

const pluginsDir = path.join(config.dataDir, 'plugins')
fs.ensureDirSync(pluginsDir)

// prepare the plugin in a subdirectory
router.post('/', session.requiredAuth, permissions.isSuperAdmin, asyncWrap(async (req, res, next) => {
  const plugin = req.body
  plugin.id = plugin.name.replace('/', '-') + '-' + semver.major(plugin.version)
  if (plugin.distTag !== 'latest') plugin.id += '-' + plugin.distTag
  const pluginDir = path.join(pluginsDir, plugin.id)
  const dir = await tmp.dir({ unsafeCleanup: true })
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

router.get('/', session.requiredAuth, permissions.isSuperAdmin, asyncWrap(async (req, res, next) => {
  const dirs = (await fs.readdir(pluginsDir)).filter(p => !p.endsWith('.json'))
  const results = []
  for (const dir of dirs) {
    const pluginInfo = await fs.readJson(path.join(pluginsDir, dir, 'plugin.json'))
    // TODO: attention à la confidentialité de cette config quand on ouvrira la config de processings aux utilisateurs
    // par example le login/mdp du user ftp pour ademe-rge est ici
    if (await fs.pathExists(path.join(pluginsDir, dir + '-config.json'))) {
      pluginInfo.config = await fs.readJson(path.join(pluginsDir, dir + '-config.json'))
    }
    results.push(pluginInfo)
  }
  res.send({
    count: dirs.length,
    results
  })
}))

router.get('/:id', session.requiredAuth, asyncWrap(async (req, res, next) => {
  const pluginInfo = await fs.readJson(path.join(pluginsDir, req.params.id, 'plugin.json'))
  res.send(pluginInfo)
}))

router.delete('/:id', session.requiredAuth, permissions.isSuperAdmin, asyncWrap(async (req, res, next) => {
  await fs.remove(path.join(pluginsDir, req.params.id))
  await fs.remove(path.join(pluginsDir, req.params.id + '-config.json'))
  res.status(204).send()
}))

router.put('/:id/config', session.requiredAuth, permissions.isSuperAdmin, asyncWrap(async (req, res, next) => {
  const { pluginConfigSchema } = await fs.readJson(path.join(pluginsDir, req.params.id, 'plugin.json'))
  const validate = ajv.compile(pluginConfigSchema)
  const valid = validate(req.body)
  if (!valid) return res.status(400).send(validate.errors)
  await fs.writeJson(path.join(pluginsDir, req.params.id + '-config.json'), req.body)
  res.send(req.body)
}))
