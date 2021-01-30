const semver = require('semver')
const config = require('config')
const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const router = module.exports = express.Router()
const tmp = require('tmp-promise')
const asyncWrap = require('../utils/async-wrap')
const permissions = require('../utils/permissions')
const session = require('../utils/session')

const pluginsDir = path.join(config.dataDir, 'plugins')
fs.ensureDirSync(pluginsDir)

// prepare the plugin in a subdirectory
router.post('/', session.requiredAuth, permissions.isAdmin, asyncWrap(async (req, res, next) => {
  const plugin = req.body
  plugin.id = plugin.name.replace('/', '-') + '-' + semver.major(plugin.version)
  const pluginDir = path.join(pluginsDir, plugin.id)
  if (await fs.exists(pluginDir)) return res.status(409).send(`Plugin ${plugin.id} already exists.`)
  const dir = await tmp.dir({ unsafeCleanup: true })
  try {
    await fs.writeFile(path.join(dir.path, 'plugin.json'), JSON.stringify(plugin, null, 2))

    // create a pseudo npm package with a dependency to the plugin referenced from the registry
    await fs.writeFile(path.join(dir.path, 'package.json'), JSON.stringify({
      name: plugin.id,
      dependencies: {
        [plugin.name]: '^' + plugin.version
      }
    }, null, 2))
    await exec('npm install --ignore-scripts', { cwd: dir.path })
    await fs.writeFile(path.join(dir.path, 'index.js'), `module.exports = require('${plugin.name}')`)
    await fs.move(dir.path, pluginDir)
  } finally {
    await dir.cleanup()
  }
  res.send(plugin)
}))

router.get('/', session.requiredAuth, permissions.isAdmin, asyncWrap(async (req, res, next) => {
  const dirs = await fs.readdir(pluginsDir)
  const results = []
  for (const dir of dirs) {
    results.push(await fs.readJson(path.join(pluginsDir, dir, 'plugin.json')))
  }
  res.send({
    count: dirs.length,
    results
  })
}))

router.delete('/:id', session.requiredAuth, permissions.isAdmin, asyncWrap(async (req, res, next) => {
  await fs.remove(path.join(pluginsDir, req.params.id))
  res.status(204).send()
}))
