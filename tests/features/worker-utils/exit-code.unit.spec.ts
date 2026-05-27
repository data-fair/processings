import { test, expect } from '@playwright/test'
import { diagnoseExit } from '../../../worker/src/utils/exit-code.ts'
import type { MemorySample } from '../../../worker/src/utils/mem-sample.ts'

const ctx = { maxHeapMB: 768, concurrency: 4, runningTasks: 3 }

const sample: MemorySample = {
  t: 0,
  phase: 'exit',
  rss: 812 * 1024 * 1024,
  heapTotal: 740 * 1024 * 1024,
  heapUsed: 723 * 1024 * 1024,
  external: 5 * 1024 * 1024,
  arrayBuffers: 1 * 1024 * 1024
}

test('code 0 -> success, no log entry', () => {
  const d = diagnoseExit(0, null, '', null, ctx)
  expect(d.category).toBe('success')
})

test('SIGTERM -> sigterm (silent)', () => {
  const d = diagnoseExit(143, 'SIGTERM', '', sample, ctx)
  expect(d.category).toBe('sigterm')
})

test('code 143 alone is sigterm', () => {
  const d = diagnoseExit(143, null, '', sample, ctx)
  expect(d.category).toBe('sigterm')
})

test('SIGKILL -> oom-host', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, ctx)
  expect(d.category).toBe('oom-host')
  expect(d.logType).toBe('error')
  expect(d.adminMessage).toContain('Task killed by the OS')
  expect(d.adminMessage).toContain('SIGKILL')
  expect(d.adminMessage).toContain('heap used: 723.0MB')
  expect(d.adminMessage).toContain('RSS: 812.0MB')
})

test('code 137 -> oom-host (even without signal)', () => {
  const d = diagnoseExit(137, null, '', sample, ctx)
  expect(d.category).toBe('oom-host')
})

test('code 134 -> oom-heap with mention of max heap config', () => {
  const d = diagnoseExit(134, null, 'FATAL ERROR: JavaScript heap out of memory', sample, ctx)
  expect(d.category).toBe('oom-heap')
  expect(d.logType).toBe('error')
  expect(d.adminMessage).toContain('exit code 134')
  expect(d.adminMessage).toContain('WORKER_TASK_MAX_HEAP_MB=768')
  expect(d.adminMessage).toContain('Concurrent tasks at exit: 3 / concurrency 4')
})

test('oom-heap reports lone-task case as 1 / concurrency N (inclusive count)', () => {
  const lone = { maxHeapMB: 768, concurrency: 4, runningTasks: 1 }
  const d = diagnoseExit(134, null, '', sample, lone)
  expect(d.adminMessage).toContain('Concurrent tasks at exit: 1 / concurrency 4')
})

test('code 134 with empty stderr still oom-heap', () => {
  const d = diagnoseExit(134, null, '', sample, ctx)
  expect(d.category).toBe('oom-heap')
})

test('SIGABRT -> oom-heap', () => {
  const d = diagnoseExit(null, 'SIGABRT', '', sample, ctx)
  expect(d.category).toBe('oom-heap')
})

test('null lastMem produces "no memory sample was reported before exit"', () => {
  const d = diagnoseExit(134, null, '', null, ctx)
  expect(d.adminMessage).toContain('no memory sample was reported before exit')
})

test('code 1 -> plugin-error using stderr', () => {
  const d = diagnoseExit(1, null, 'TypeError: foo is not a function', null, ctx)
  expect(d.category).toBe('plugin-error')
  expect(d.logType).toBe('error')
  expect(d.adminMessage).toContain('TypeError: foo')
})

test('unknown code 99 -> unknown', () => {
  const d = diagnoseExit(99, null, 'weird', null, ctx)
  expect(d.category).toBe('unknown')
  expect(d.logType).toBe('error')
  expect(d.adminMessage).toContain('code=99')
})

test('null code, null signal -> unknown', () => {
  const d = diagnoseExit(null, null, '', null, ctx)
  expect(d.category).toBe('unknown')
})
