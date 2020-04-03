const CronJob = require('cron').CronJob
const tasksUtils = require('./tasks')
const cronUtils = require('../utils/cron')
const tasks = {}
const debug = require('debug')('scheduler')

function register(processing, db) {
  if (processing.scheduling && processing.scheduling.unit === 'trigger') {
    debug('Task :', processing.title, 'is triggered manually')
    return
  }
  const cronStr = cronUtils.fromScheduling(processing.scheduling)
  if (tasks[processing.id]) {
    debug('Task :', processing.title, 'is already registered, canceling it')
    tasks[processing.id].stop()
    delete tasks[processing.id]
  }
  debug('Registering task :', processing.title, cronStr)
  tasks[processing.id] = new CronJob(cronStr, async function() {
    debug('Running task :', processing.title)
    await tasksUtils.run(processing, db)
  }, null, true)
}

exports.init = async function(db) {
  const processings = await db.collection('processings').find({ active: true }).toArray()
  processings.forEach(processing => {
    register(processing, db)
  })
}

exports.update = register

exports.delete = function(processing) {
  if (tasks[processing.id]) {
    debug('Deleting task :', processing.title)
    tasks[processing.id].stop()
    delete tasks[processing.id]
  }
}
