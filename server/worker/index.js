const config = require('config')
const spawn = require('child-process-promise').spawn
const locks = require('../utils/locks')
const runs = require('../utils/runs')
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
  await locks.init(db)
  console.log('start worker')
  while (!stopped) {
    // Maintain max concurrency by checking if there is a free spot in an array of promises
    for (let i = 0; i < config.worker.concurrency; i++) {
      if (currentIters[i]) continue
      currentIters[i] = iter(db)
      currentIters[i].catch(err => console.error('error in worker iter', err))
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
  let run, processing
  let stderr = ''
  try {
    run = await acquireNext(db)
    if (!run) return
    processing = await db.collection('processings').findOne({ _id: run.processing._id })

    debug(`run "${processing.title}" > ${run._id}`)

    // Run a task in a dedicated child process for  extra resiliency to fatal memory exceptions
    const spawnPromise = spawn('node', ['server', run._id, processing._id], {
      env: { ...process.env, MODE: 'task' },
      stdio: ['ignore', 'inherit', 'pipe'],
    })
    spawnPromise.childProcess.stderr.on('data', data => {
      debug('[spawned task stderr] ' + data)
      stderr += data
    })
    await spawnPromise

    await runs.finish(db, run)

    if (hooks[processing._id]) {
      hooks[processing._id].resolve(await db.collection('runs').findOne({ _id: run._id }))
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
      console.warn(`failure ${processing.title} > ${run._id}`, errorMessage.join('\n'))

      await runs.finish(db, run, errorMessage.join('\n'))

      if (hooks[processing._id]) hooks[processing._id].reject({ run, message: errorMessage.join('\n') })
    } else {
      console.warn('failure in worker', err)
    }
  } finally {
    if (run) {
      locks.release(db, processing._id)
    }
    if (processing && processing.scheduling.type !== 'trigger') {
      await runs.createNext(db, processing)
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
