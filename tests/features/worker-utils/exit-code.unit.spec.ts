import { test, expect } from '@playwright/test'
import { diagnoseExit } from '../../../worker/src/utils/exit-code.ts'
import type { MemorySample } from '../../../worker/src/utils/mem-sample.ts'
import type { ExternalSample } from '../../../worker/src/task/external-sampler.ts'

const ctx = { maxHeapMB: 768, concurrency: 4, runningTasks: 3, selfKilled: false }

const sample: MemorySample = {
  t: 0,
  phase: 'exit',
  rss: 812 * 1024 * 1024,
  heapTotal: 740 * 1024 * 1024,
  heapUsed: 723 * 1024 * 1024,
  external: 5 * 1024 * 1024,
  arrayBuffers: 1 * 1024 * 1024
}

const ext: ExternalSample = {
  rssBytes: 815 * 1024 * 1024,
  cpuRatio: 0.92,
  readAt: 1700000000000
}

test('code 0 -> success, no log entry', () => {
  const d = diagnoseExit(0, null, '', null, null, ctx)
  expect(d.category).toBe('success')
  expect(d.adminMessage).toBe('')
  expect(d.userMessage).toBe('')
})

test('SIGTERM -> sigterm (silent)', () => {
  const d = diagnoseExit(143, 'SIGTERM', '', sample, null, ctx)
  expect(d.category).toBe('sigterm')
  expect(d.userMessage).toBe('')
})

test('code 143 alone is sigterm', () => {
  const d = diagnoseExit(143, null, '', sample, null, ctx)
  expect(d.category).toBe('sigterm')
})

test('SIGKILL -> oom-host with English adminMessage and French userMessage', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, null, ctx)
  expect(d.category).toBe('oom-host')
  // English ops message (cause only, metrics live in adminMetrics)
  expect(d.adminMessage).toContain('Task killed by the OS')
  expect(d.adminMessage).toContain('SIGKILL')
  expect(d.adminMetrics).toContain('heap used: 723.0MB')
  expect(d.adminMetrics).toContain('RSS: 812.0MB')
  // French user-facing message in run log
  expect(d.userMessage).toMatch(/tué|terminé par le système/i)
  expect(d.userMessage).toContain('SIGKILL')
})

test('code 137 -> oom-host (even without signal)', () => {
  const d = diagnoseExit(137, null, '', sample, null, ctx)
  expect(d.category).toBe('oom-host')
})

test('SIGKILL with selfKilled=true -> sigterm category (worker-initiated forceful kill)', () => {
  const selfCtx = { ...ctx, selfKilled: true }
  const d = diagnoseExit(null, 'SIGKILL', '', sample, null, selfCtx)
  expect(d.category).toBe('sigterm')
  expect(d.userMessage).toBe('')
})

test('code 137 with selfKilled=true -> sigterm category', () => {
  const selfCtx = { ...ctx, selfKilled: true }
  const d = diagnoseExit(137, null, '', sample, null, selfCtx)
  expect(d.category).toBe('sigterm')
})

test('code 134 -> oom-heap with mention of max heap config (English admin + French user)', () => {
  const d = diagnoseExit(134, null, 'FATAL ERROR: JavaScript heap out of memory', sample, null, ctx)
  expect(d.category).toBe('oom-heap')
  // English admin message (cause + mitigation)
  expect(d.adminMessage).toContain('exit code 134')
  expect(d.adminMessage).toContain('WORKER_TASK_MAX_HEAP_MB=768')
  expect(d.adminMessage).toContain('Concurrent tasks at exit: 3 / concurrency 4')
  // French user message
  expect(d.userMessage).toMatch(/mémoire|tas/i)
  expect(d.userMessage).toContain('768')
})

test('oom-heap reports lone-task case as 1 / concurrency N (inclusive count)', () => {
  const lone = { maxHeapMB: 768, concurrency: 4, runningTasks: 1, selfKilled: false }
  const d = diagnoseExit(134, null, '', sample, null, lone)
  expect(d.adminMessage).toContain('Concurrent tasks at exit: 1 / concurrency 4')
})

test('code 134 with empty stderr still oom-heap', () => {
  const d = diagnoseExit(134, null, '', sample, null, ctx)
  expect(d.category).toBe('oom-heap')
})

test('SIGABRT -> oom-heap', () => {
  const d = diagnoseExit(null, 'SIGABRT', '', sample, null, ctx)
  expect(d.category).toBe('oom-heap')
})

test('null lastMem produces "no memory sample was reported before exit"', () => {
  const d = diagnoseExit(134, null, '', null, null, ctx)
  expect(d.adminMetrics).toContain('no memory sample was reported before exit')
})

test('code 1 -> plugin-error using stderr (same message both fields, plugin owns language)', () => {
  const d = diagnoseExit(1, null, 'TypeError: foo is not a function', null, null, ctx)
  expect(d.category).toBe('plugin-error')
  expect(d.adminMessage).toContain('TypeError: foo')
  expect(d.userMessage).toContain('TypeError: foo')
})

test('unknown code 99 -> unknown', () => {
  const d = diagnoseExit(99, null, 'weird', null, null, ctx)
  expect(d.category).toBe('unknown')
  expect(d.adminMessage).toContain('code=99')
  // French user message for unknown
  expect(d.userMessage).toMatch(/inattendue|inattendu/i)
})

test('null code, null signal -> unknown', () => {
  const d = diagnoseExit(null, null, '', null, null, ctx)
  expect(d.category).toBe('unknown')
})

test('oom-host with lastExt includes external RSS and CPU ratio in adminMetrics', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, ext, ctx)
  expect(d.category).toBe('oom-host')
  expect(d.adminMetrics).toMatch(/Last seen RSS \(external\):\s*815\.0MB/)
  expect(d.adminMetrics).toMatch(/CPU usage \(external\):\s*0\.92/)
})

test('oom-host without lastExt keeps cause clean and reports child RSS in metrics', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, null, ctx)
  expect(d.category).toBe('oom-host')
  expect(d.adminMessage).toContain('Task killed by the OS')
  expect(d.adminMetrics).toContain('RSS: 812.0MB')
})

test('oom-heap with both lastMem and lastExt renders heap primary, external secondary in metrics', () => {
  const d = diagnoseExit(134, 'SIGABRT', '', sample, ext, ctx)
  expect(d.category).toBe('oom-heap')
  // Primary: child-reported heap (V8-internal)
  expect(d.adminMetrics).toContain('heap used: 723.0MB')
  // Secondary: external RSS line
  expect(d.adminMetrics).toMatch(/Last seen RSS \(external\):\s*815\.0MB/)
})

test('plugin-error reports stderr as message and external line in metrics', () => {
  const d = diagnoseExit(1, null, 'EACCES: permission denied', null, ext, ctx)
  expect(d.category).toBe('plugin-error')
  expect(d.adminMessage).toContain('EACCES: permission denied')
  expect(d.adminMetrics).toMatch(/Last seen RSS \(external\):\s*815\.0MB/)
})

test('lastExt with null cpuRatio omits CPU usage line', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, { ...ext, cpuRatio: null }, ctx)
  expect(d.adminMetrics).toMatch(/Last seen RSS \(external\):\s*815\.0MB/)
  expect(d.adminMetrics).not.toMatch(/CPU usage/)
})

test('oom-host with lastExt includes French external RSS and CPU usage in userMetrics', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, ext, ctx)
  expect(d.userMetrics).toMatch(/Dernier RSS observé \(parent\)\s*:\s*815\.0MB/)
  expect(d.userMetrics).toMatch(/Utilisation CPU \(parent\)\s*:\s*0\.92/)
})

test('lastExt with null cpuRatio omits CPU usage line from French userMetrics', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, { ...ext, cpuRatio: null }, ctx)
  expect(d.userMetrics).toMatch(/Dernier RSS observé \(parent\)/)
  expect(d.userMetrics).not.toMatch(/Utilisation CPU/)
})

test('oom-host renders external RSS BEFORE in-process memLine in metrics (external is primary)', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, ext, ctx)
  const extIdx = d.adminMetrics.indexOf('Last seen RSS (external)')
  const memIdx = d.adminMetrics.indexOf('Last memory sample')
  expect(extIdx).toBeGreaterThanOrEqual(0)
  expect(memIdx).toBeGreaterThan(0)
  expect(extIdx).toBeLessThan(memIdx)
})
