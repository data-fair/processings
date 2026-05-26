import { buildErrorMessageFromStderr } from './worker-operations.ts'
import { toMB, type MemorySample } from './mem-sample.ts'

export type ExitCategory =
  | 'success' | 'sigterm' | 'oom-heap' | 'oom-host'
  | 'plugin-error' | 'unknown'

export type ExitDiagnosis = {
  category: ExitCategory
  adminMessage: string
  logType: 'info' | 'debug' | 'error'
}

export type DiagnoseContext = {
  maxHeapMB: number
  concurrency: number
  runningTasks: number
}

const memLine = (lastMem: MemorySample | null, maxHeapMB: number): string => {
  if (!lastMem) return 'no memory sample was reported before exit'
  return `Last memory sample — heap used: ${toMB(lastMem.heapUsed)} / ${maxHeapMB}MB; RSS: ${toMB(lastMem.rss)}.`
}

const oomHeapMessage = (lastMem: MemorySample | null, ctx: DiagnoseContext): string => [
  'Task exceeded the JavaScript heap limit (heap OOM, exit code 134).',
  memLine(lastMem, ctx.maxHeapMB),
  `Concurrent tasks at exit: ${ctx.runningTasks} / concurrency ${ctx.concurrency}.`,
  `Configuration: WORKER_TASK_MAX_HEAP_MB=${ctx.maxHeapMB}.`,
  'Mitigation: raise WORKER_TASK_MAX_HEAP_MB, lower WORKER_CONCURRENCY, or inspect the plugin for a memory leak.'
].join('\n')

const oomHostMessage = (lastMem: MemorySample | null, ctx: DiagnoseContext): string => [
  'Task killed by the OS (SIGKILL, likely container OOM-killer).',
  memLine(lastMem, ctx.maxHeapMB),
  'The container memory limit was probably exceeded.',
  'Mitigation: raise the container memory limit, or lower WORKER_CONCURRENCY.'
].join('\n')

export const diagnoseExit = (
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
  lastMem: MemorySample | null,
  ctx: DiagnoseContext
): ExitDiagnosis => {
  if (code === 0 && signal === null) {
    return { category: 'success', adminMessage: '', logType: 'info' }
  }
  if (signal === 'SIGTERM' || code === 143) {
    return { category: 'sigterm', adminMessage: '', logType: 'info' }
  }
  if (signal === 'SIGKILL' || code === 137) {
    return {
      category: 'oom-host',
      adminMessage: oomHostMessage(lastMem, ctx),
      logType: 'error'
    }
  }
  if (code === 134 || signal === 'SIGABRT') {
    return {
      category: 'oom-heap',
      adminMessage: oomHeapMessage(lastMem, ctx),
      logType: 'error'
    }
  }
  if (code === 1) {
    return {
      category: 'plugin-error',
      adminMessage: buildErrorMessageFromStderr(stderr, 'child process exited with code 1'),
      logType: 'error'
    }
  }
  return {
    category: 'unknown',
    adminMessage: `Task ended unexpectedly (code=${code}, signal=${signal ?? 'null'}). ${buildErrorMessageFromStderr(stderr, '')}`.trim(),
    logType: 'error'
  }
}
