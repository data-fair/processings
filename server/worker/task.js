const config = require('config')
const path = require('path')
const fs = require('fs-extra')
const tmp = require('tmp-promise')

exports.run = async ({ db }) => {
  const [run, processing] = await Promise.all([
    db.collection('runs').findOne({ _id: process.argv[2] }),
    db.collection('processings').findOne({ _id: process.argv[3] }),
  ])
  const log = {
    step(msg) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'step', msg } } })
    },
    debug(msg, extra) {
      if (!processing.debug) return
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'debug', msg, extra } } })
    },
    info(msg, extra) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'info', msg, extra } } })
    },
    error(msg, extra) {
      return db.collection('runs')
        .updateOne({ _id: run._id }, { $push: { log: { type: 'error', msg, extra } } })
    },
  }

  if (run.status === 'running') {
    log.info('Reprise après interruption.')
  }
  await db.collection('runs')
    .updateOne({ _id: run._id }, { $set: { status: 'running', startedAt: new Date().toISOString() } })

  const pluginDir = path.resolve(config.dataDir, 'plugins', processing.plugin)

  let pluginConfig = {}
  if (await fs.exists(pluginDir + '-config.json')) {
    pluginConfig = await fs.readJson(pluginDir + '-config.json')
  }
  const pluginModule = require(pluginDir)
  await pluginModule.run(pluginConfig, processing.config || {}, {
    tmpDir: await tmp.dir({ unsafeCleanup: true }),
    log,
  })
}
