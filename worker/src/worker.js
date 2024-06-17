/* eslint-disable no-async-promise-executor */
import { existsSync } from 'fs'
import resolvePath from 'resolve-path'
import mongo from '@data-fair/lib/node/mongo.js'
import limits from './utils/limits.js'
import * as locks from '@data-fair/lib/node/locks.js'
import config from './config.js'
import kill from 'tree-kill'
import { startObserver, stopObserver, internalError } from '@data-fair/lib/node/observer.js'
import { createNext } from '../../shared/runs.js'
import { initPublisher } from '../../shared/ws.js'
import { initMetrics } from './utils/metrics.js'
import { finish } from './utils/runs.js'
import { spawn } from 'child-process-promise'
import Debug from 'debug'
const debug = Debug('worker')
const debugLoop = Debug('worker-loop')

/** @typedef {import('../../shared/types/run/index.js').Run} Run */

/** @type {boolean} */
let stopped = false
/** @type {[Promise<void> | null]} */
const promisePool = [null]
/** @type {Record<string, number>} */
const pids = {}

/** @type {(channel: string, data: any) => Promise<void>} */
let wsPublish

// Loop promises, resolved when stopped
/** @type {Promise<void>} */
let mainLoopPromise
/** @type {Promise<void>} */
let killLoopPromise

// Start the worker (start the mail loop and all dependencies)
export const start = async () => {
  if (!existsSync(config.dataDir) && process.env.NODE_ENV === 'production') {
    throw new Error(`Data directory ${resolvePath(config.dataDir)} was not mounted`)
  }
  await mongo.connect(config.mongoUrl, { readPreference: 'primary', maxPoolSize: 1 })
  const db = mongo.db
  await locks.init(db)
  wsPublish = await initPublisher(db)
  if (config.observer.active) {
    await initMetrics(db)
    await startObserver(config.observer.port)
  }
  await limits.initLimits()

  // initialize empty promise pool
  for (let i = 0; i < config.worker.concurrency; i++) {
    promisePool[i] = null
  }

  // non-blocking secondary kill loop
  killLoop(db)

  const lastActivity = new Date().getTime()
  mainLoop(db, lastActivity)
}

// Stop and wait for all workers to finish their current task
export const stop = async () => {
  stopped = true
  await locks.stop()
  await Promise.all(promisePool.filter(p => !!p))
  await Promise.all([mainLoopPromise, killLoopPromise])
  await mongo.client.close()
  if (config.observer.active) await stopObserver()
}

/**
 * Main loop
 * Check for available runs to process and start a task for each run
 * If the worker is inactive, wait for a longer delay
 * @param {import('mongodb').Db} db
 * @param {number} lastActivity the timestamp of the last activity of the worker
 */
async function mainLoop (db, lastActivity) {
  mainLoopPromise = new Promise(async (resolve) => {
    // eslint-disable-next-line no-unmodified-loop-condition
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
      debugLoop('index of a free slot', freeSlot)

      const run = await acquireNext(db)

      if (!run) {
        continue
      } else {
        debugLoop('work on run', run._id, run.title)
        lastActivity = new Date().getTime()
      }

      if (stopped) continue

      promisePool[freeSlot] = iter(db, run)
      // @ts-ignore -> we are sure that the slot is a Promise<void>
      promisePool[freeSlot].catch(err => {
        internalError('worker-iter, error in worker iter', { error: err })
        console.error('(worker-iter) error in worker iter', err)
      })
      // always empty the slot after the promise is finished
      // @ts-ignore -> we are sure that the slot is a Promise<void>
      promisePool[freeSlot].finally(() => {
        promisePool[freeSlot] = null
      })

      await new Promise(resolve => setTimeout(resolve, config.worker.interval))
    }
    resolve()
  })
}

/**
 * A secondary loop to handle killing tasks
 * @param {import('mongodb').Db} db
 * @returns {Promise<void>}
 */
async function killLoop (db) {
  killLoopPromise = new Promise(async (resolve) => {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!stopped) {
      await new Promise(resolve => setTimeout(resolve, config.worker.killInterval))
      try {
        /** @type {import('mongodb').Collection<Run>} */
        const runsCollection = mongo.db.collection('runs')
        for await (const run of runsCollection.find({ status: 'kill' })) {
          killRun(db, run).catch(err => {
            internalError('worker-task-kill', 'error while killing task', { error: err })
          })
        }
      } catch (err) {
        internalError('worker-loop-kill', 'error while killing task loop', { error: err })
        console.error('(loop-kill) error while killing task loop', err)
      }
    }
    resolve()
  })
}

/**
 * Kill a run
 * @param {import('mongodb').Db} db
 * @param {Run} run the run to kill
 * @returns {Promise<void>}
 */
async function killRun (db, run) {
  if (!pids[run._id]) {
    const ack = await locks.acquire(run.processing._id, 'worker-loop-kill')
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
  kill(pids[run._id], 'SIGTERM')

  // grace period before sending SIGKILL
  // this is more than the internal grace period of the task, so it should never be used
  await new Promise(resolve => setTimeout(resolve, config.worker.gracePeriod * 1.2))
  if (pids[run._id]) {
    console.warn('send SIGKILL for forceful interruption of a task that did not stop properly', run.processing._id, run._id, pids[run._id])
    kill(pids[run._id], 'SIGKILL')
  }
}

/**
 * Manage a run
 * @param {import('mongodb').Db} db
 * @param {Run} run the run to start
 * @returns {Promise<void>}
 */
async function iter (db, run) {
  let stderr = ''
  /** @type {import('mongodb').Collection<import('../../shared/types/processing/index.js').Processing>} */
  const processingsCollection = db.collection('processings')
  const processing = await processingsCollection.findOne({ _id: run.processing._id })

  if (!processing) {
    internalError('worker-missing-processing', 'found a run without associated processing, weird')
    console.error('(missing-processing) found a run without associated processing, weird')
    /** @type {import('mongodb').Collection<Run>} */
    const runsCollection = db.collection('runs')
    await runsCollection.deleteOne({ _id: run._id })
    return
  }
  if (!processing.active) {
    await finish(db, wsPublish, run, 'le traitement a été désactivé', 'error')
    return
  }

  debug(`run "${processing.title}" > ${run._id}`)

  try {
    const remaining = await limits.remaining(db, processing.owner)
    if (remaining.processingsSeconds === 0) {
      await finish(db, wsPublish, run, 'le temps de traitement autorisé est épuisé', 'error')
      // @test:spy("processingsSecondsExceeded")
      return
    }

    // Run a task in a dedicated child process for extra resiliency to fatal memory exceptions
    const path = process.env.NODE_ENV === 'test' ? './worker/src/task/' : './src/task/'
    const spawnPromise = spawn('node', [path, run._id, processing._id], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    spawnPromise.childProcess.stdout?.on('data', data => {
      process.stdout.write('[spawned task stdout] ' + data)
      if (data.includes('<running>')) {
        // @test:spy("isRunning")
      }
    })
    spawnPromise.childProcess.stderr?.on('data', data => {
      process.stderr.write('[spawned task stderr] ' + data)
      if (stderr.length <= 2000) {
        stderr += data
        if (stderr.length > 2000) {
          stderr = stderr.slice(0, 2000) + '...'
        }
      }
    })
    pids[run._id] = spawnPromise.childProcess.pid || -1
    await spawnPromise // wait for the task to finish
    await finish(db, wsPublish, run)
  } catch (/** @type {any} */ err) {
    // Build back the original error message from the stderr of the child process
    const errorMessage = []
    if (stderr) {
      stderr.split('\n')
        .filter(line => !!line && !line.startsWith('worker:') && !line.includes('NODE_TLS_REJECT_UNAUTHORIZED'))
        .forEach(line => errorMessage.push(line))
    }

    if (!errorMessage.length) {
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
      await locks.release(run.processing._id)
    }
    if (processing && processing.scheduling.type !== 'trigger') { // we create the next scheduled run
      try {
        await createNext(db, processing)
      } catch (err) {
        internalError('worker-next-run', 'failure while creating next run', { error: err })
        console.error('(next-run) failure while creating next run', err)
      }
    }
  }
}

/**
 * Acquire the next run to process, if a run is already running, check if the lock was released,
 * meaning the task was brutally interrupted
 * @param {import('mongodb').Db} db
 * @returns {Promise<Run | undefined>} the next run to process
 */
async function acquireNext (db) {
  // Random sort prevents from insisting on the same failed dataset again and again
  /** @type {import('mongodb').AggregationCursor<Run>} */
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
    let run = /** @type {Run} */(await cursor.next())
    const ack = await locks.acquire(run.processing._id, 'worker-loop-iter')
    debug('acquire lock for run ?', run._id, ack)

    if (ack) {
      // re-fetch run to prevent some race condition
      /** @type {import('mongodb').Collection<Run>} */
      const runsCollection = db.collection('runs')
      run = /** @type {Run} */(await runsCollection.findOne({ _id: run._id }))

      // if we could acquire the lock it means the task was brutally interrupted
      if (run.status === 'running') {
        try {
          console.warn('we had to close a run that was stuck in running status', run)
          await finish(db, wsPublish, run, 'le traitement a été interrompu suite à une opération de maintenance', 'error')
          /** @type {import('mongodb').Collection<import('../../shared/types/processing/index.js').Processing>} */
          const processingsCollection = db.collection('processings')
          const processing = await processingsCollection.findOne({ _id: run.processing._id })
          await locks.release(run.processing._id)
          if (processing && processing.scheduling.type !== 'trigger') {
            await createNext(db, processing) // we create the next scheduled run
          }
        } catch (err) {
          internalError('worker-manage-running', 'failure while closing a run that was left in running status by error', { error: err })
          console.error('(manage-running) failure while closing a run that was left in running status by error', err)
        }
        continue
      }
      if (run.status !== 'triggered' && run.status !== 'scheduled') {
        continue
      }
      return run
    }
  }
}
