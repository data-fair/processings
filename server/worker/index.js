const config = require('config')
const spawn = require('child-process-promise').spawn
const kill = require('tree-kill')
const locks = require('../utils/locks')
const runs = require('../utils/runs')
const debug = require('debug')('worker')
const debugLoop = require('debug')('worker-loop')

// resolve functions that will be filled when we will be asked to stop the workers
// const stopResolves = {}
let stopped = false
const promisePool = []

// Hooks for testing
const hooks = {}
exports.hook = (key) => new Promise((resolve, reject) => {
  hooks[key] = { resolve, reject }
})
// clear also for testing
exports.clear = () => {
  for (let i = 0; i < config.worker.concurrency; i++) {
    for (let i = 0; i < config.worker.concurrency; i++) {
      if (promisePool[i]) {
        promisePool[i].catch(() => {})
        delete promisePool[i]
      }
    }
  }
}

/* eslint no-unmodified-loop-condition: 0 */
// Run main loop !
exports.start = async ({ db }) => {
  await locks.init(db)
  console.log('start worker')

  // initialize empty promise pool
  for (let i = 0; i < config.worker.concurrency; i++) {
    promisePool[i] = null
  }
  let lastActivity = new Date().getTime()

  // non-blocking secondary kill loop
  killLoop(db)

  while (!stopped) {
    const now = new Date().getTime()
    if ((now - lastActivity) > config.worker.inactivityDelay) {
      // inactive polling interval
      debugLoop('the worker is inactive wait extra delay', config.worker.inactiveInterval)
      await new Promise(resolve => setTimeout(resolve, config.worker.inactiveInterval))
    } else {
      // base polling interval
      await new Promise(resolve => setTimeout(resolve, config.worker.interval))
    }

    // wait for an available spot in the promise pool
    if (!promisePool.includes(null)) {
      debugLoop('pool is full, wait for a free spot')
      await Promise.any(promisePool)
    }
    const freeSlot = promisePool.findIndex(p => !p)
    debugLoop('free slot', freeSlot)

    const run = await acquireNext(db)

    if (!run) {
      continue
    } else {
      debugLoop('work on run', run._id, run.title)
      lastActivity = new Date().getTime()
    }

    if (stopped) continue

    promisePool[freeSlot] = iter(db, run)
    promisePool[freeSlot].catch(err => console.error('error in worker iter', err))
    // always empty the slot after the promise is finished
    promisePool[freeSlot].finally(() => {
      promisePool[freeSlot] = null
      // we release the slot right away, but we do not release the lock on the resource
      // this is to prevent working very fast on the same resource in series
      debugLoop('release resource after delay', config.worker.releaseInterval)
      setTimeout(() => locks.release(db, run.processing._id), config.worker.releaseInterval)
    })

    await new Promise(resolve => setTimeout(resolve, config.worker.interval))
  }
}

// Stop and wait for all workers to finish their current task
exports.stop = async () => {
  stopped = true
  await Promise.all(promisePool.filter(p => !!p))
  if (config.worker.releaseInterval) {
    await new Promise(resolve => setTimeout(resolve, config.worker.releaseInterval))
  }
}

// a secondary loop to handle killing tasks
const pids = {}
async function killLoop(db) {
  while (!stopped) {
    await new Promise(resolve => setTimeout(resolve, config.worker.killInterval))
    try {
      const runs = await db.collection('runs').find({ status: 'kill' }).toArray()
      for (const run of runs) {
        killRun(db, run).catch(err => console.error('error while killing task', err))
      }
    } catch (err) {
      console.error(err)
    }
  }
}

async function killRun(db, run) {
  if (!pids[run._id]) {
    const ack = await locks.acquire(db, run.processing._id)
    if (ack) {
      console.warn('the run should be killed, it is not locked by another worker and we have no running PID, mark it as already killed', run._id)
      run.status = 'killed'
      await runs.finish(db, run)
    }
    return
  }
  // send SIGTERM for graceful stopping of the tasks
  debugLoop('send SIGTERM', run._id, pids[run._id])
  kill(pids[run._id])
  // grace period before sending SIGKILL
  // this is more than the internal grace period of the task, so it should never be used
  await new Promise(resolve => setTimeout(resolve, config.worker.gracePeriod * 1.2))
  if (pids[run._id]) {
    console.warn('send SIGKILL for forceful interruption of a task that did not stop properly', run.processing._id, run._id, pids[run._id])
    kill(pids[run._id], 'SIGKILL')
  }
}

async function iter(db, run) {
  let processing
  let stderr = ''
  try {
    processing = await db.collection('processings').findOne({ _id: run.processing._id })
    if (!processing) {
      console.error('found a run without associated processing, weird')
      await db.collection('runs').deleteOne({ _id: run._id })
      return
    }
    if (!processing.active) {
      await runs.finish(db, run, 'le traitement a été désactivé')
      return
    }

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
    pids[run._id] = spawnPromise.childProcess.pid
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
      // case of interruption by a SIGTERM
      if (err.code === 143) {
        run.status = 'killed'
        await runs.finish(db, run)
        if (hooks[processing._id]) hooks[processing._id].resolve({ run, message: 'interrupted' })
      } else {
        console.warn(`failure ${processing.title} > ${run._id}`, errorMessage.join('\n'))
        await runs.finish(db, run, errorMessage.join('\n'))
        if (hooks[processing._id]) hooks[processing._id].reject({ run, message: errorMessage.join('\n') })
      }
    } else {
      console.warn('failure in worker', err)
    }
  } finally {
    if (run) {
      delete pids[run._id]
      locks.release(db, run.processing._id)
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
