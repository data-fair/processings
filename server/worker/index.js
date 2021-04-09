const config = require('config')
const spawn = require('child-process-promise').spawn
const locks = require('../utils/locks')
const debug = require('debug')('worker')

// resolve functions that will be filled when we will be asked to stop the workers
// const stopResolves = {}
let stopped = false
const currentIters = []

// Hooks for testing
const hooks = {}
exports.hook = (key) => new Promise((resolve, reject) => {
  hooks[key] = { resolve, reject }
})
// clear also for testing
exports.clear = () => {
  for (let i = 0; i < config.worker.concurrency; i++) {
    if (currentIters[i]) {
      currentIters[i].catch(() => {})
      delete currentIters[i]
    }
  }
}

/* eslint no-unmodified-loop-condition: 0 */
// Run main loop !
exports.start = async ({ db }) => {
  console.log('start worker')
  while (!stopped) {
    // Maintain max concurrency by checking if there is a free spot in an array of promises
    for (let i = 0; i < config.worker.concurrency; i++) {
      if (currentIters[i]) continue
      currentIters[i] = iter(db)
      currentIters[i].finally(() => {
        currentIters[i] = null
      })
    }

    await new Promise(resolve => setTimeout(resolve, config.worker.interval))
  }
}

// Stop and wait for all workers to finish their current task
exports.stop = async () => {
  stopped = true
  await Promise.all(currentIters.filter(p => !!p))
}

async function iter(db) {
  let run
  let stderr = ''
  try {
    run = await acquireNext(db)
    if (!run) return

    debug(`run "${run.processing.title}" > ${run._id}`)

    // Run a task in a dedicated child process for  extra resiliency to fatal memory exceptions
    const spawnPromise = spawn('node', ['server', run._id, run.processing._id], {
      env: { ...process.env, MODE: 'task' },
      stdio: ['ignore', 'inherit', 'pipe'],
    })
    spawnPromise.childProcess.stderr.on('data', data => {
      debug('[spawned task stderr] ' + data)
      stderr += data
    })
    await spawnPromise

    await db.collection('runs').updateOne({ _id: run._id }, { $set: { status: 'finished' } })

    if (hooks[run.processing._id]) {
      hooks[run.processing._id].resolve(await db.collection('runs').findOne({ _id: run._id }))
    }
  } catch (err) {
    // Build back the original error message from the stderr of the child process
    const errorMessage = []
    if (stderr) {
      stderr.split('\n').filter(line => !!line && !line.startsWith('worker:')).forEach(line => {
        errorMessage.push(line)
      })
    } else {
      errorMessage.push(err.message)
    }

    if (run) {
      console.warn(`failure ${run.processing.title} > ${run._id}`, err)
      await db.collection('runs').updateOne({ _id: run._id }, { $set: { status: 'error' } })
      if (hooks[run.processing._id]) hooks[run.processing._id].reject({ run, message: errorMessage.join('\n') })
    } else {
      console.warn('failure in worker', err)
    }
  } finally {
    if (run) {
      locks.release(db, run.processing._id)
    }
  }
}

async function acquireNext(db) {
  // Random sort prevents from insisting on the same failed dataset again and again
  const cursor = db.collection('runs')
    .aggregate([{
       $match: {
       $or: [
            { status: 'triggered' },
            { status: 'scheduled', scheduledAt: { $lte: new Date().toISOString() } },
            // we also fetch running tasks to check if lock was released (meaning task was brutally interrupted)
            { status: 'running' },
          ],
        },
      }, { $sample: { size: 100 } }])
  while (await cursor.hasNext()) {
    const run = await cursor.next()
    // console.log('resource', resource)
    const ack = await locks.acquire(db, run.processing._id)
    if (ack) return run
  }
}