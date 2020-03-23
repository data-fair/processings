const schedule = require('node-schedule')
const tasksUtils = require('./tasks')
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
  tasks[processing.id] = schedule.scheduleJob(str + ' * * *', async function() {
    await tasksUtils.run(processing, db)
  })
}

exports.init = async function(db) {
  const processings = await db.collection('processings').find({ active: true }).toArray()
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
