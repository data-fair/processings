import { test, expect } from '@playwright/test'
import {
  createExternalSamplerFactory,
  type ExternalSample
} from '../../../worker/src/task/external-sampler.ts'
import type { ProcStatSnapshot } from '../../../worker/src/utils/proc-stat.ts'

// Stubs for the metrics gauge writer (just collect calls).
const collectingGauges = () => {
  const calls: Array<{ slot: number; sample: ExternalSample }> = []
  return {
    calls,
    update: (slot: number, sample: ExternalSample) => { calls.push({ slot, sample }) }
  }
}

const snap = (utime: number, stime: number, rss: number, readAt: number): ProcStatSnapshot =>
  ({ utimeTicks: utime, stimeTicks: stime, rssBytes: rss, readAt })

test('baseline tick emits RSS with cpuRatio: null', () => {
  const reader = (_pid: number) => snap(0, 0, 50 * 1024 * 1024, 1000)
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 0, (s) => samples.push(s))
  expect(samples).toHaveLength(1)
  expect(samples[0].rssBytes).toBe(50 * 1024 * 1024)
  expect(samples[0].cpuRatio).toBeNull()
  expect(gauges.calls).toHaveLength(1)
  handle.stop()
})

test('returns no-op handle when baseline read returns null', () => {
  const reader = (_pid: number) => null
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 100, (s) => samples.push(s))
  expect(samples).toHaveLength(0)
  expect(gauges.calls).toHaveLength(0)
  expect(() => handle.stop()).not.toThrow()
})

test('second tick computes cpuRatio against baseline', async () => {
  const queue: ProcStatSnapshot[] = [
    snap(0, 0, 50 * 1024 * 1024, 1000),
    snap(80, 20, 60 * 1024 * 1024, 2000) // 100 ticks / 1s @ 100 Hz = 1.0
  ]
  const reader = (_pid: number) => queue.shift() ?? null
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 10, (s) => samples.push(s))
  // Wait for one timer tick
  await new Promise(resolve => setTimeout(resolve, 30))
  handle.stop()
  expect(samples.length).toBeGreaterThanOrEqual(2)
  expect(samples[0].cpuRatio).toBeNull()
  expect(samples[1].cpuRatio).toBeCloseTo(1.0, 3)
})

test('reader returning null mid-stream stops the sampler', async () => {
  const queue: (ProcStatSnapshot | null)[] = [
    snap(0, 0, 50 * 1024 * 1024, 1000),
    null,
    snap(999, 999, 999 * 1024 * 1024, 9999) // should NEVER be read
  ]
  const reader = (_pid: number) => queue.shift() ?? null
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 10, (s) => samples.push(s))
  await new Promise(resolve => setTimeout(resolve, 50))
  handle.stop()
  expect(samples).toHaveLength(1) // only the baseline
})

test('intervalMs <= 0 emits baseline only, no timer', async () => {
  let calls = 0
  const reader = (_pid: number) => { calls++; return snap(0, 0, 50 * 1024 * 1024, 1000) }
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 0, (s) => samples.push(s))
  await new Promise(resolve => setTimeout(resolve, 30))
  handle.stop()
  expect(samples).toHaveLength(1)
  expect(calls).toBe(1)
})

test('onSample callback throwing does not crash the sampler', async () => {
  const queue: ProcStatSnapshot[] = [
    snap(0, 0, 50 * 1024 * 1024, 1000),
    snap(10, 10, 60 * 1024 * 1024, 2000)
  ]
  const reader = (_pid: number) => queue.shift() ?? null
  const gauges = collectingGauges()
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 10, () => { throw new Error('boom') })
  await new Promise(resolve => setTimeout(resolve, 30))
  // If we got here without an unhandled rejection, the sampler swallowed it.
  expect(gauges.calls.length).toBeGreaterThanOrEqual(1)
  handle.stop()
})

test('stop() is idempotent', () => {
  const reader = (_pid: number) => snap(0, 0, 50 * 1024 * 1024, 1000)
  const gauges = collectingGauges()
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 10, () => {})
  handle.stop()
  expect(() => handle.stop()).not.toThrow()
})
