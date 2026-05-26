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

// Process-level memory gauges, named to match prom-client defaults so a
// standard Node.js Grafana dashboard recognises them. We don't call
// collectDefaultMetrics() because that would re-register these names
// without our labels.
const rssGauge = new Gauge({
  name: 'process_resident_memory_bytes',
  help: 'Resident memory size in bytes',
  labelNames: ['kind', 'slot'],
  registers: [servicePromRegistry]
})

const heapTotalGauge = new Gauge({
  name: 'nodejs_heap_size_total_bytes',
  help: 'Process heap size from Node.js in bytes',
  labelNames: ['kind', 'slot'],
  registers: [servicePromRegistry]
})

const heapUsedGauge = new Gauge({
  name: 'nodejs_heap_size_used_bytes',
  help: 'Process heap size used from Node.js in bytes',
  labelNames: ['kind', 'slot'],
  registers: [servicePromRegistry]
})

const externalGauge = new Gauge({
  name: 'nodejs_external_memory_bytes',
  help: 'Node.js external memory size in bytes',
  labelNames: ['kind', 'slot'],
  registers: [servicePromRegistry]
})

const slotStateGauge = new Gauge({
  name: 'df_processings_task_slot_state',
  help: 'Task slot state: 0 idle, 1 running',
  labelNames: ['slot'],
  registers: [servicePromRegistry]
})

const exitedCounter = new Counter({
  name: 'df_processings_runs_exited_total',
  help: 'Task run exits by diagnostic category',
  labelNames: ['category'],
  registers: [servicePromRegistry]
})

export const updateTaskMemoryGauges = (slot: number, sample: MemorySample): void => {
  const labels = { kind: 'task', slot: String(slot) }
  rssGauge.set(labels, sample.rss)
  heapTotalGauge.set(labels, sample.heapTotal)
  heapUsedGauge.set(labels, sample.heapUsed)
  externalGauge.set(labels, sample.external)
}

export const updateWorkerMemoryGauges = (): void => {
  const m = process.memoryUsage()
  const labels = { kind: 'worker', slot: '' }
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
