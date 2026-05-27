import { Histogram, Gauge, Counter } from 'prom-client'
import { servicePromRegistry } from '@data-fair/lib-node/observer.js'
import mongo from '#mongo'
import type { MemorySample } from './mem-sample.ts'
import type { ExitCategory } from './exit-code.ts'

const runsMetrics = new Histogram({
  name: 'df_processings_runs',
  help: 'Number and duration in seconds of processing runs',
  buckets: [0.1, 1, 10, 60, 600],
  labelNames: ['status', 'owner']
})

// Per-pod memory gauges for the worker process and each task slot. Named
// with a df_processings_ prefix to avoid colliding with the unlabelled
// process_*/nodejs_* gauges that collectDefaultMetrics installs on the
// default register from @data-fair/lib-node/observer.js. Default register
// → exposed on `GET /metrics` and scraped per replica.
const rssGauge = new Gauge({
  name: 'df_processings_process_resident_memory_bytes',
  help: 'Resident memory size in bytes',
  labelNames: ['kind', 'slot']
})

const heapTotalGauge = new Gauge({
  name: 'df_processings_process_heap_size_total_bytes',
  help: 'Process heap size from Node.js in bytes',
  labelNames: ['kind', 'slot']
})

const heapUsedGauge = new Gauge({
  name: 'df_processings_process_heap_size_used_bytes',
  help: 'Process heap size used from Node.js in bytes',
  labelNames: ['kind', 'slot']
})

const externalGauge = new Gauge({
  name: 'df_processings_process_external_memory_bytes',
  help: 'Node.js external memory size in bytes',
  labelNames: ['kind', 'slot']
})

const slotStateGauge = new Gauge({
  name: 'df_processings_task_slot_state',
  help: 'Task slot state: 0 idle, 1 running',
  labelNames: ['slot']
})

const exitedCounter = new Counter({
  name: 'df_processings_runs_exited_total',
  help: 'Task run exits by diagnostic category',
  labelNames: ['category']
})

// Slots are reused across runs; when a task finishes we deliberately leave
// the last sample in place (spec: stale gauges acceptable, reads as
// "slot idle, last task ended at X heap"). Pair with setSlotState(false).
export const updateTaskMemoryGauges = (slot: number, sample: MemorySample): void => {
  const labels = { kind: 'task', slot: String(slot) }
  rssGauge.set(labels, sample.rss)
  heapTotalGauge.set(labels, sample.heapTotal)
  heapUsedGauge.set(labels, sample.heapUsed)
  externalGauge.set(labels, sample.external)
}

export const updateWorkerMemoryGauges = (): void => {
  const m = process.memoryUsage()
  const labels = { kind: 'worker' }
  rssGauge.set(labels, m.rss)
  heapTotalGauge.set(labels, m.heapTotal)
  heapUsedGauge.set(labels, m.heapUsed)
  externalGauge.set(labels, m.external)
}

export const setSlotState = (slot: number, running: boolean): void => {
  slotStateGauge.set({ slot: String(slot) }, running ? 1 : 0)
}

export const recordExit = (category: ExitCategory): void => {
  exitedCounter.inc({ category })
}

const initMetrics = async (): Promise<void> => {
  // eslint-disable-next-line no-new
  new Gauge({
    name: 'df_processings_processings_total',
    help: 'Total number of processings',
    registers: [servicePromRegistry],
    async collect () {
      this.set(await mongo.processings.estimatedDocumentCount())
    }
  })
}

export { initMetrics, runsMetrics }

// TEMPORARY stub for Task 3 — replaced with the real implementation in Task 4.
export const updateTaskExternalGauges = (_slot: number, _sample: { rssBytes: number; cpuRatio: number | null; readAt: number }): void => {}
