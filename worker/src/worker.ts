/* eslint-disable no-async-promise-executor */
import type { AggregationCursor, Collection, Db } from 'mongodb'
import type { Processing, Run } from '#api/types'

import { spawn } from 'child-process-promise'
import Debug from 'debug'
import { existsSync } from 'fs'
import resolvePath from 'resolve-path'
import kill from 'tree-kill'

import * as wsEmitter from '@data-fair/lib-node/ws-emitter.js'
import { startObserver, stopObserver, internalError } from '@data-fair/lib-node/observer.js'
import upgradeScripts from '@data-fair/lib-node/upgrade-scripts.js'
import { createNext } from '@data-fair/processing-shared/runs.ts'
import config from '#config'
import mongo from '#mongo'
import locks from '#locks'
import limits from './utils/limits.ts'
import { initMetrics } from './utils/metrics.ts'
import { finish } from './utils/runs.ts'

const debug = Debug('worker')
const debugLoop = Debug('worker-loop')

let stopped = false
const promisePool: [Promise<void> | null] = [null]
const pids: Record<string, number> = {}

// Loop promises, resolved when stopped
let mainLoopPromise: Promise<void>
let killLoopPromise: Promise<void>

// Start the worker (start the mail loop and all dependencies)
export const start = async () => {
  if (!existsSync(config.dataDir) && process.env.NODE_ENV === 'production') {
    throw new Error(`Data directory ${resolvePath(config.dataDir)} was not mounted`)
  }
  await mongo.init()
  const db = mongo.db
  await locks.start(db)
  await upgradeScripts(db, locks, config.upgradeRoot)
  await wsEmitter.init(db)
  if (config.observer.active) {
    await initMetrics(db)
    await startObserver(config.observer.port)
  }

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
  await Promise.all(promisePool.filter(p => !!p))
  await Promise.all([mainLoopPromise, killLoopPromise])
  await locks.stop()
  await mongo.close()
  if (config.observer.active) await stopObserver()
}

/**
 * Main loop
 * Check for available runs to process and start a task for each run
 * If the worker is inactive, wait for a longer delay
 * @param db
 * @param lastActivity the timestamp of the last activity of the worker
 */
async function mainLoop (db: Db, lastActivity: number) {
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

      const iterPromise = iter(db, run)
      promisePool[freeSlot] = iterPromise
      // empty the slot after the promise is finished
      // do not catch failure, they should trigger a restart of the loop
      iterPromise.then(() => { promisePool[freeSlot] = null })

      await new Promise(resolve => setTimeout(resolve, config.worker.interval))
    }
    resolve()
  })
}

/**
 * A secondary loop to handle killing tasks
 */
async function killLoop (db: Db) {
  killLoopPromise = new Promise(async (resolve) => {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!stopped) {
      await new Promise(resolve => setTimeout(resolve, config.worker.killInterval))
      try {
        const runsCollection = mongo.db.collection('runs') as Collection<Run>
        for await (const run of runsCollection.find({ status: 'kill' })) {
          try {
            await killRun(db, run)
          } catch (err) {
            internalError('worker-task-kill', err)
          }
        }
      } catch (err) {
        internalError('worker-loop-kill', err)
        console.error('(loop-kill) error while killing task loop', err)
      }
    }
    resolve()
  })
}

/**
 * Kill a run
 */
async function killRun (db: Db, run: Run) {
  if (!pids[run._id]) {
    const ack = await locks.acquire(run.processing._id, 'worker-loop-kill')
    if (ack) {
      try {
        console.warn('the run should be killed, it is not locked by another worker and we have no running PID, mark it as already killed', run._id)
        debug('mark as already killed', run)
        run.status = 'killed'
        await finish(db, run)
      } finally {
        await locks.release(run.processing._id)
      }
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
 */
async function iter (db: Db, run: Run) {
  let stderr = ''
  const processing = await db.collection<Processing>('processings').findOne({ _id: run.processing._id })

  if (!processing) {
    internalError('worker-missing-processing', 'found a run without associated processing, weird')
    await db.collection<Run>('runs').deleteOne({ _id: run._id })
    return
  }
  if (!processing.active) {
    await finish(db, run, 'le traitement a été désactivé', 'error')
    return
  }

  debug(`run "${processing.title}" > ${run._id}`)

  try {
    const remaining = await limits.remaining(db, processing.owner)
    if (remaining.processingsSeconds === 0) {
      await finish(db, run, 'le temps de traitement autorisé est épuisé', 'error')
      // @test:spy("processingsSecondsExceeded")
      return
    }

    // Run a task in a dedicated child process for extra resiliency to fatal memory exceptions
    const path = process.env.NODE_ENV === 'test' ? './worker/src/task/index.ts' : './src/task/index.ts'
    const spawnPromise = spawn('node', ['--experimental-strip-types', path, run._id, processing._id], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    spawnPromise.childProcess.stdout?.on('data', data => {
      process.stdout.write(`[spawned task stdout] ${run.processing._id} / ${run._id}` + data)
      if (data.includes('<running>')) {
        // @test:spy("isRunning")
      }
    })
    spawnPromise.childProcess.stderr?.on('data', data => {
      process.stderr.write(`[spawned task stdout] ${run.processing._id} / ${run._id}` + data)
      if (stderr.length <= 2000) {
        stderr += data
        if (stderr.length > 2000) {
          stderr = stderr.slice(0, 2000) + '...'
        }
      }
    })
    pids[run._id] = spawnPromise.childProcess.pid || -1
    await spawnPromise // wait for the task to finish
    await finish(db, run)
  } catch (err: any) {
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
        await finish(db, run)
        // @test:spy("isKilled")
      } else {
        console.warn(`failure ${processing.title} > ${run._id}`, errorMessage.join('\n'))
        await finish(db, run, errorMessage.join('\n'))
        // @test:spy("isFailure")
      }
    } else {
      internalError('worker', err)
    }
  } finally {
    if (run) {
      delete pids[run._id]
      await locks.release(run.processing._id)
    }
    if (processing && processing.scheduling.length) { // we create the next scheduled run
      try {
        await createNext(db, locks, processing)
      } catch (err) {
        // retry once in case of failure, a concurrent call to createNext might have been made, but failed
        await new Promise(resolve => setTimeout(resolve, 2000))
        await createNext(db, locks, processing)
      }
    }
  }
}

/**
 * Acquire the next run to process, if a run is already running, check if the lock was released,
 * meaning the task was brutally interrupted
 * @param db
 * @returns the next run to process
 */
async function acquireNext (db: Db): Promise<Run | undefined> {
  // Random sort prevents from insisting on the same failed dataset again and again
  const cursor = db.collection<Run>('runs')
    .aggregate([{
      $match: {
        $or: [
          { status: 'triggered', scheduledAt: { $lte: new Date().toISOString() } },
          { status: 'scheduled', scheduledAt: { $lte: new Date().toISOString() } },
          // we also fetch running tasks to check if lock was released (meaning task was brutally interrupted)
          { status: 'running' }
        ]
      }
    }, { $sample: { size: 100 } }]) as AggregationCursor<Run>

  while (await cursor.hasNext()) {
    let run = (await cursor.next())!
    const ack = await locks.acquire(run.processing._id, 'worker-loop-iter')
    debug('acquire lock for run ?', run._id, ack)

    if (ack) {
      // re-fetch run to prevent some race condition
      const foundRun = await db.collection<Run>('runs').findOne({ _id: run._id })
      if (!foundRun) continue
      run = foundRun

      // if we could acquire the lock it means the task was brutally interrupted
      if (run.status === 'running') {
        try {
          console.warn('we had to close a run that was stuck in running status', run)
          await finish(db, run, 'le traitement a été interrompu suite à une opération de maintenance', 'error')
          const processing = await db.collection<Processing>('processings').findOne({ _id: run.processing._id })
          await locks.release(run.processing._id)
          if (processing && processing.scheduling.length) {
            await createNext(db, locks, processing) // we create the next scheduled run
          }
        } catch (err) {
          const message = `failure while closing a run that was left in running status by error (${run.processing._id} / ${run._id})`
          internalError('worker-manage-running', err, message)
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
