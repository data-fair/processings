import mongo from '@data-fair/lib/node/mongo.js'
import limits from './utils/limits.js'
import locks from './utils/locks.js'
import config from './config.js'
import kill from 'tree-kill'
import { startObserver, stopObserver, internalError } from '@data-fair/lib/node/observer.js'
import { initPublisher } from '../../shared/ws.js'
import { initMetrics } from './utils/metrics.js'
import { finish, createNext } from './utils/runs.js'
import { spawn } from 'child-process-promise'
import debug from 'debug'
const debugLoop = debug('loop')

let stopped = false
const promisePool = []

// Hooks for testing
const hooks = {}
export const hook = (key) => new Promise((resolve, reject) => {
  hooks[key] = { resolve, reject }
})

// clear also for testing
export const clear = () => {
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
export const start = async () => {
  await mongo.connect(config.mongoUrl, { readPreference: 'primary' })
  const db = mongo.db
  await locks.init(db)
  const wsPublish = await initPublisher(db)
  if (config.prometheus.active) {
    await initMetrics(mongo.db)
    await startObserver()
  }
  await limits.initLimits()

  // initialize empty promise pool
  for (let i = 0; i < config.worker.concurrency; i++) {
    promisePool[i] = null
  }

  // non-blocking secondary kill loop
  killLoop(db, wsPublish)

  const lastActivity = new Date().getTime()
  runLoop(db, wsPublish, lastActivity)
}

// Stop and wait for all workers to finish their current task
export const stop = async () => {
  stopped = true
  await mongo.client.close()
  if (config.prometheus.active) await stopObserver()
  await Promise.all(promisePool.filter(p => !!p))
}

// Main loop
async function runLoop (db, wsPublish, lastActivity) {
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

    const run = await acquireNext(db, wsPublish)

    if (!run) {
      continue
    } else {
      debugLoop('work on run', run._id, run.title)
      lastActivity = new Date().getTime()
    }

    if (stopped) continue

    promisePool[freeSlot] = iter(db, wsPublish, run)
    promisePool[freeSlot].catch(err => {
      internalError('worker-iter, error in worker iter', { error: err })
      console.error('(worker-iter) error in worker iter', err)
    })
    // always empty the slot after the promise is finished
    promisePool[freeSlot].finally(() => {
      promisePool[freeSlot] = null
    })

    await new Promise(resolve => setTimeout(resolve, config.worker.interval))
  }
}

// a secondary loop to handle killing tasks
const pids = {}
async function killLoop (db, wsPublish) {
  while (!stopped) {
    await new Promise(resolve => setTimeout(resolve, config.worker.killInterval))
    try {
      const runs = await db.collection('runs').find({ status: 'kill' }).toArray()
      for (const run of runs) {
        killRun(db, wsPublish, run).catch(err => {
          internalError('worker-task-kill', 'error while killing task', { error: err })
          console.error('(task-kill) error while killing task', err)
        })
      }
    } catch (err) {
      internalError('worker-loop-kill', 'error while killing task loop', { error: err })
      console.error('(loop-kill) error while killing task loop', err)
    }
  }
}

async function killRun (db, wsPublish, run) {
  if (!pids[run._id]) {
    const ack = await locks.acquire(db, run.processing._id)
    if (ack) {
      console.warn('the run should be killed, it is not locked by another worker and we have no running PID, mark it as already killed', run._id)
      debug('mark as already killed', run)
      run.status = 'killed'
      await finish(db, wsPublish, run)
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

async function iter (db, wsPublish, run) {
  let processing
  let stderr = ''
  try {
    processing = await db.collection('processings').findOne({ _id: run.processing._id })
    if (!processing) {
      internalError('worker-missing-processing', 'found a run without associated processing, weird')
      console.error('(missing-processing) found a run without associated processing, weird')
      await db.collection('runs').deleteOne({ _id: run._id })
      return
    }
    if (!processing.active) {
      await finish(db, wsPublish, run, 'le traitement a été désactivé', 'error')
      if (hooks[processing._id]) hooks[processing._id].reject({ run, message: 'le traitement a été désactivé' })
      return
    }
    // @test:spy("isTriggered")
    if (hooks[processing._id]) hooks[processing._id].resolve(run)

    debug(`run "${processing.title}" > ${run._id}`)

    const remaining = await limits.remaining(db, processing.owner)
    if (remaining.processingsSeconds === 0) {
      await finish(db, wsPublish, run, 'le temps de traitement autorisé est épuisé', 'error')
      // @test:spy("processingsSecondsExceeded")
      return
    }

    // Run a task in a dedicated child process for extra resiliency to fatal memory exceptions
    const spawnPromise = spawn('node', [process.env.NODE_ENV === 'test' ? './worker/src/task/index.js' : './src/task/index.js', run._id, processing._id], {
      env: process.env,
      stdio: ['ignore', 'inherit', 'pipe']
    })
    spawnPromise.childProcess.stderr.on('data', data => {
      debug('[spawned task stderr] ' + data)
      stderr += data
    })
    pids[run._id] = spawnPromise.childProcess.pid
    await spawnPromise

    await finish(db, wsPublish, run)
    if (hooks[processing._id]) hooks[processing._id].resolve(await db.collection('runs').findOne({ _id: run._id }))
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
        await finish(db, wsPublish, run)
        // @test:spy("isKilled")
      } else {
        console.warn(`failure ${processing.title} > ${run._id}`, errorMessage.join('\n'))
        await finish(db, wsPublish, run, errorMessage.join('\n'))
        // @test:spy("isFailure")
      }
    } else {
      internalError('worker', 'failure in worker', { error: err })
      console.error('(worker) failure in worker', err)
    }
  } finally {
    if (run) {
      delete pids[run._id]
      locks.release(db, run.processing._id)
    }
    if (processing && processing.scheduling.type !== 'trigger') {
      try {
        await createNext(db, processing)
      } catch (err) {
        internalError('worker-next-run', 'failure while creating next run', { error: err })
        console.error('(next-run) failure while creating next run', err)
      }
    }
  }
}

async function acquireNext (db, wsPublish) {
  // Random sort prevents from insisting on the same failed dataset again and again
  const cursor = db.collection('runs')
    .aggregate([{
      $match: {
        $or: [
          { status: 'triggered', scheduledAt: { $lte: new Date().toISOString() } },
          { status: 'scheduled', scheduledAt: { $lte: new Date().toISOString() } },
          // we also fetch running tasks to check if lock was released (meaning task was brutally interrupted)
          { status: 'running' }
        ]
      }
    }, { $sample: { size: 100 } }])
  while (await cursor.hasNext()) {
    let run = await cursor.next()
    const ack = await locks.acquire(db, run.processing._id)
    debug('acquire lock for run ?', run, ack)
    if (ack) {
      // re-fetch run to prevent some race condition
      run = await db.collection('runs').findOne({ _id: run._id })

      // if we could asquire the lock it means the task was brutally interrupted
      if (run.status === 'running') {
        try {
          console.warn('we had to close a run that was stuck in running status', run)
          await finish(db, wsPublish, run, 'le traitement a été interrompu suite à une opération de maintenance', 'error')
          const processing = await db.collection('processings').findOne({ _id: run.processing._id })
          await locks.release(db, run.processing._id)
          if (processing && processing.scheduling.type !== 'trigger') {
            await createNext(db, processing)
          }
        } catch (err) {
          internalError('worker-manage-running', 'failure while closing a run that was left in running status by error', { error: err })
          console.error('(manage-running) failure while closing a run that was left in running status by error', err)
        }
        continue
      }
      return run
    }
  }
}
