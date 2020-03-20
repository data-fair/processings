const schedule = require('node-schedule')
const path = require('path')
const config = require('config')
const baseUrl = config.dataFairUrl + '/api/v1/datasets'
const axios = require('axios')

const tasks = {}

function register(processing, db) {
  let str = '*/' + processing.periodicity.value
  if (processing.periodicity.unit === 'heures') str = '* ' + str
  else if (processing.periodicity.unit === 'minutes') str = str + ' *'
  else str = str + ' * *'
  if (tasks[processing.id]) {
    console.log('task', processing.title, 'is already registered, canceling it')
    tasks[processing.id].cancel()
    delete tasks[processing.id]
  }
  console.log('Registering task', processing.title, str + ' * * *')
  const task = require(path.join(__dirname, '../../sources', processing.source.type))
  tasks[processing.id] = schedule.scheduleJob(str + ' * * *', async function() {
    let status = 'ok'
    let logMessage = ''
    try {
      const data = await task(processing.source.config)
      const results = await axios.post(baseUrl + '/' + processing.dataset.id + '/_bulk_lines', data, { headers: { 'x-apiKey': config.dataFairAPIKey } })
      // TODO : throw error of results.data.ndErrors > 0
      logMessage = `${results.data.nbOk} éléments mis à jour`
    } catch (err) {
      logMessage = err
      status = 'erreur'
    }
    await db.collection('processings').findOneAndUpdate({ id: processing.id }, {
      $set: { 'last-execution': { date: new Date(), status } },
      $push: { logs: { $each: [{ date: new Date(), message: logMessage, status }], $slice: -10000 } }
    })
  })
}

exports.init = async function(db) {
  const processings = await db.collection('processings').find({ status: 'running' }).toArray()
  processings.forEach(processing => {
    register(processing, db)
  })
}

exports.update = register

exports.delete = function(processingId) {
  if (tasks[processingId]) {
    console.log('deleting task', processingId)
    tasks[processingId].cancel()
    delete tasks[processingId]
  }
}
