/* eslint-disable no-async-promise-executor */
import type { Run } from '#api/types'

import { spawn } from 'node:child_process'
import os from 'node:os'
import Debug from 'debug'
import { existsSync } from 'fs'
import resolvePath from 'resolve-path'
import kill from 'tree-kill'

import { init as wsInit } from '@data-fair/lib-node/ws-emitter.js'
import { startObserver, stopObserver, internalError } from '@data-fair/lib-node/observer.js'
import upgradeScripts from '@data-fair/lib-node/upgrade-scripts.js'
import { createNext } from '@data-fair/processings-shared/runs.ts'
import eventsQueue from '@data-fair/lib-node/events-queue.js'
import config from '#config'
import mongo from '#mongo'
import locks from '#locks'
import limits from './utils/limits.ts'
import { initMetrics, updateTaskMemoryGauges, updateWorkerMemoryGauges, setSlotState, recordExit, setExternalRssActive, updateTaskExternalGauges } from './utils/metrics.ts'
import { finish } from './utils/runs.ts'
import { buildErrorMessageFromStderr } from './utils/worker-operations.ts'
import { splitMemSampleLines, type MemorySample } from './utils/mem-sample.ts'
import { diagnoseExit, type ExitDiagnosis } from './utils/exit-code.ts'
import { createExternalSamplerFactory, type ExternalSample, type ExternalSamplerHandle } from './task/external-sampler.ts'
import { isSupported as procStatIsSupported } from './utils/proc-stat.ts'
import { computeBudget, detectContainerLimitMB, formatReport } from './utils/memory-budget.ts'

const debug = Debug('worker')
const debugLoop = Debug('worker-loop')

let stopped = false
const promisePool: [Promise<void> | null] = [null]
const pids: Record<string, number> = {}
// Run IDs for which the worker has escalated to SIGKILL via killRun(). Used by
// iter() to distinguish a worker-initiated forceful kill from a kernel/cgroup
// OOM-killer SIGKILL. Cleared in iter()'s finally.
const selfKilled: Set<string> = new Set()

let externalSamplerActive = false
let externalSamplerFactory: ReturnType<typeof createExternalSamplerFactory> | null = null

// Loop promises, resolved when stopped
let mainLoopPromise: Promise<void>
let killLoopPromise: Promise<void>

// Start the worker (start the mail loop and all dependencies)
export const start = async () => {
  if (config.dataDir && !existsSync(config.dataDir) && process.env.NODE_ENV === 'production') {
    throw new Error(`Data directory ${resolvePath(config.dataDir)} was not mounted`)
  }
  await mongo.init()
  await locks.start(mongo.db)
  await upgradeScripts(mongo.db, locks, config.upgradeRoot)
  await wsInit(mongo.db)
  if (config.observer.active) {
    await initMetrics()
    await startObserver(config.observer.port)
  }
  if (config.privateEventsUrl) {
    if (!config.secretKeys.events) {
      internalError('processings', 'Missing secretKeys.events in config')
    } else {
      await eventsQueue.start({ eventsUrl: config.privateEventsUrl, eventsSecret: config.secretKeys.events })
    }
  }

  // Startup memory budget report
  const containerLimitMB = detectContainerLimitMB()
  const hostTotalMB = Math.round(os.totalmem() / (1024 * 1024))
  const workerProcessRssMB = Math.round(process.memoryUsage().rss / (1024 * 1024))
  const budget = computeBudget({
    hostTotalMB,
    containerLimitMB,
    workerProcessRssMB,
    concurrency: config.worker.concurrency,
    taskMaxHeapMB: config.worker.task.maxHeapMB,
    warnThresholdPct: config.worker.task.memoryHeadroomWarnPct
  })
  const report = formatReport(budget)
  if (budget.status === 'ok') console.log(report)
  else console.warn(report)

  externalSamplerActive = config.worker.task.externalSamplerEnabled && procStatIsSupported()
  setExternalRssActive(externalSamplerActive)
  if (externalSamplerActive) {
    externalSamplerFactory = createExternalSamplerFactory({ updateGauge: updateTaskExternalGauges })
    console.log('[external-sampler] enabled: per-slot RSS/CPU sampled from /proc')
  } else if (config.worker.task.externalSamplerEnabled && !procStatIsSupported()) {
    console.warn('[external-sampler] disabled: /proc is not available on this platform')
  } else {
    console.log('[external-sampler] disabled by configuration (WORKER_TASK_EXTERNAL_SAMPLER_ENABLED=false)')
  }

  // Initialise the worker's own memory gauges and keep them fresh. A sample
  // interval of 0 disables periodic sampling (see default.mjs comment); the
  // single initial sample remains.
  updateWorkerMemoryGauges()
  if (config.worker.task.memorySampleIntervalMs > 0) {
    const workerGaugeTimer = setInterval(updateWorkerMemoryGauges, config.worker.task.memorySampleIntervalMs)
    workerGaugeTimer.unref()
  }

  // initialize empty promise pool
  for (let i = 0; i < config.worker.concurrency; i++) {
    promisePool[i] = null
  }

  // non-blocking secondary kill loop
  killLoop()

  const lastActivity = new Date().getTime()
  mainLoop(lastActivity)
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
 * @param lastActivity the timestamp of the last activity of the worker
 */
async function mainLoop (lastActivity: number) {
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

      const run = await acquireNext()

      if (!run) {
        continue
      } else {
        debugLoop('work on run', run._id, run.title)
        lastActivity = new Date().getTime()
      }

      if (stopped) continue

      const iterPromise = iter(run, freeSlot)
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
async function killLoop () {
  killLoopPromise = new Promise(async (resolve) => {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!stopped) {
      await new Promise(resolve => setTimeout(resolve, config.worker.killInterval))
      try {
        for await (const run of mongo.runs.find({ status: 'kill' })) {
          try {
            await killRun(run)
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
async function killRun (run: Run) {
  if (!pids[run._id]) {
    const ack = await locks.acquire(run.processing._id, 'worker-loop-kill')
    if (ack) {
      try {
        console.warn('the run should be killed, it is not locked by another worker and we have no running PID, mark it as already killed', run._id)
        debug('mark as already killed', run)
        run.status = 'killed'
        await finish(run)
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
    // Mark as self-kill BEFORE delivering the signal — diagnoseExit reads
    // this set in iter()'s catch handler, which can be entered as soon as the
    // child observes the signal.
    selfKilled.add(run._id)
    kill(pids[run._id], 'SIGKILL')
  }
}

/**
 * Manage a run
 */
async function iter (run: Run, freeSlot: number) {
  let stderr = ''
  let stdoutResidual = ''
  let lastMem: MemorySample | null = null
  let lastExt: ExternalSample | null = null
  const processing = await mongo.processings.findOne({ _id: run.processing._id })

  try {
    if (!processing) {
      internalError('worker-missing-processing', 'found a run without associated processing, weird')
      await mongo.runs.deleteOne({ _id: run._id })
      return
    }
    if (!processing.active) {
      await finish(run, 'le traitement a été désactivé', 'error')
      return
    }

    debug(`run "${processing.title}" > ${run._id}`)

    const remaining = await limits.remaining(processing.owner)
    if (remaining.processingsSeconds === 0) {
      await finish(run, 'le temps de traitement autorisé est épuisé', 'error')
      // @test:spy("processingsSecondsExceeded")
      return
    }

    // Run a task in a dedicated child process for extra resiliency to fatal memory exceptions
    const child = spawn('node', [
      `--max-old-space-size=${config.worker.task.maxHeapMB}`,
      '--disable-warning=ExperimentalWarning',
      './src/task/index.ts', run._id, processing._id
    ], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    child.stdout?.on('data', data => {
      const text = data.toString('utf8')
      const out = splitMemSampleLines(text, stdoutResidual)
      stdoutResidual = out.residual
      for (const sample of out.samples) {
        lastMem = sample
        updateTaskMemoryGauges(freeSlot, sample)
      }
      // Echo non-sample lines for ops visibility (preserving prior behaviour)
      for (const line of out.other) {
        process.stdout.write(`[spawned task stdout] ${run.processing._id} / ${run._id} ${line}\n`)
        if (line.includes('<running>')) {
          // @test:spy("isRunning")
        }
      }
    })
    child.stderr?.on('data', data => {
      process.stderr.write(`[spawned task stderr] ${run.processing._id} / ${run._id}` + data)
      if (stderr.length <= 2000) {
        stderr += data
        if (stderr.length > 2000) {
          stderr = stderr.slice(0, 2000) + '...'
        }
      }
    })
    pids[run._id] = child.pid || -1
    setSlotState(freeSlot, true)

    const sampler: ExternalSamplerHandle | null = (child.pid && externalSamplerActive && externalSamplerFactory)
      ? externalSamplerFactory.start(freeSlot, child.pid, config.worker.task.memorySampleIntervalMs, (ext) => { lastExt = ext })
      : null

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code, signal) => {
        sampler?.stop()
        setSlotState(freeSlot, false)
        if (code === 0 && signal === null) resolve()
        else {
          const err: any = new Error(`child process exited (code=${code}, signal=${signal ?? 'null'})`)
          err.code = code
          err.signal = signal
          reject(err)
        }
      })
      child.on('error', (err) => {
        sampler?.stop()
        reject(err)
      })
    })
    await finish(run)
  } catch (err: any) {
    if (run) {
      // Includes this task's own slot (still in pool until iter resolves) —
      // the count reflects concurrency right before exit, which is what an
      // operator cares about for saturation diagnosis.
      const runningTasks = promisePool.filter(p => p !== null).length
      const diag: ExitDiagnosis = diagnoseExit(
        err.code ?? null,
        (err.signal ?? null) as NodeJS.Signals | null,
        stderr,
        lastMem,
        lastExt,
        {
          maxHeapMB: config.worker.task.maxHeapMB,
          concurrency: config.worker.concurrency,
          runningTasks,
          selfKilled: selfKilled.has(run._id)
        }
      )
      recordExit(diag.category)
      if (diag.category === 'sigterm') {
        run.status = 'killed'
        await finish(run)
        // @test:spy("isKilled")
      } else {
        // Admin (English) → ops console; user (French) → run.log (debug level,
        // matching the pre-existing convention for technical failure messages).
        // Resource metrics (RSS/CPU/heap) are kept as a separate log entry so
        // they don't get appended to the human-readable error.
        console.warn(`failure ${processing?.title ?? run.processing.title} > ${run._id} [${diag.category}]`, [diag.adminMessage || err.message, diag.adminMetrics].filter(Boolean).join('\n'))
        await finish(run, diag.userMessage || buildErrorMessageFromStderr(stderr, err.message), 'debug', diag.userMetrics || undefined)
        // @test:spy("isFailure")
      }
    } else {
      internalError('worker', err)
    }
  } finally {
    if (run) {
      delete pids[run._id]
      selfKilled.delete(run._id)
      await locks.release(run.processing._id)
    }
    if (processing) {
      const refreshedProcessing = await mongo.processings.findOne({ _id: processing._id })
      if (refreshedProcessing && refreshedProcessing.scheduling.length && refreshedProcessing.active) { // we create the next scheduled run
        try {
          await createNext(mongo.db, locks, refreshedProcessing)
        } catch (err) {
          // retry once in case of failure, a concurrent call to createNext might have been made, but failed
          await new Promise(resolve => setTimeout(resolve, 2000))
          await createNext(mongo.db, locks, refreshedProcessing)
        }
      }
    }
  }
}

/**
 * Acquire the next run to process, if a run is already running, check if the lock was released,
 * meaning the task was brutally interrupted
 * @returns the next run to process
 */
async function acquireNext (): Promise<Run | undefined> {
  // Random sort prevents from insisting on the same failed dataset again and again
  const cursor = mongo.runs
    .aggregate<Run>([{
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
    let run = (await cursor.next())!
    const ack = await locks.acquire(run.processing._id, 'worker-loop-iter')
    debug('acquire lock for run ?', run._id, ack)

    if (ack) {
      // re-fetch run to prevent some race condition
      const foundRun = await mongo.runs.findOne({ _id: run._id })
      if (!foundRun) {
        await locks.release(run.processing._id)
        continue
      }
      run = foundRun

      // if we could acquire the lock it means the task was brutally interrupted
      if (run.status === 'running') {
        try {
          console.warn('we had to close a run that was stuck in running status', run)
          await finish(run, 'le traitement a été interrompu suite à une opération de maintenance', 'error')
          const processing = await mongo.processings.findOne({ _id: run.processing._id })
          await locks.release(run.processing._id)
          if (processing && processing.active && processing.scheduling.length) {
            await createNext(mongo.db, locks, processing) // we create the next scheduled run
          }
        } catch (err) {
          const message = `failure while closing a run that was left in running status by error (${run.processing._id} / ${run._id})`
          internalError('worker-manage-running', err, message)
          await locks.release(run.processing._id)
        }
        continue
      }
      if (run.status !== 'triggered' && run.status !== 'scheduled') {
        await locks.release(run.processing._id)
        continue
      }
      return run
    }
  }
}
