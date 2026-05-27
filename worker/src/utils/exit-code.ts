import { buildErrorMessageFromStderr } from './worker-operations.ts'
import { toMB, type MemorySample } from './mem-sample.ts'

export type ExitCategory =
  | 'success' | 'sigterm' | 'oom-heap' | 'oom-host'
  | 'plugin-error' | 'unknown'

export type ExitDiagnosis = {
  category: ExitCategory
  // English text for ops/console/Prometheus context.
  adminMessage: string
  // French text written to run.log (user-facing). Empty for silent categories.
  userMessage: string
  logType: 'info' | 'debug' | 'error'
}

export type DiagnoseContext = {
  maxHeapMB: number
  concurrency: number
  runningTasks: number
  // True when the worker itself escalated to SIGKILL via killRun (grace-period
  // expiry). Lets us avoid mis-categorising a self-initiated forceful kill as
  // a container OOM-killer event.
  selfKilled: boolean
}

const memLine = (lastMem: MemorySample | null, maxHeapMB: number): string => {
  if (!lastMem) return 'no memory sample was reported before exit'
  return `Last memory sample — heap used: ${toMB(lastMem.heapUsed)} / ${maxHeapMB}MB; RSS: ${toMB(lastMem.rss)}.`
}

const memLineFr = (lastMem: MemorySample | null, maxHeapMB: number): string => {
  if (!lastMem) return 'aucune mesure mémoire n\'a été reportée avant la sortie'
  return `Dernière mesure mémoire — heap utilisé : ${toMB(lastMem.heapUsed)} / ${maxHeapMB}MB ; RSS : ${toMB(lastMem.rss)}.`
}

const oomHeapAdmin = (lastMem: MemorySample | null, ctx: DiagnoseContext): string => [
  'Task exceeded the JavaScript heap limit (heap OOM, exit code 134).',
  memLine(lastMem, ctx.maxHeapMB),
  `Concurrent tasks at exit: ${ctx.runningTasks} / concurrency ${ctx.concurrency}.`,
  `Configuration: WORKER_TASK_MAX_HEAP_MB=${ctx.maxHeapMB}.`,
  'Mitigation: raise WORKER_TASK_MAX_HEAP_MB, lower WORKER_CONCURRENCY, or inspect the plugin for a memory leak.'
].join('\n')

const oomHeapUser = (lastMem: MemorySample | null, ctx: DiagnoseContext): string => [
  `Le traitement a dépassé la limite de mémoire (tas JavaScript) allouée à la tâche (${ctx.maxHeapMB}MB).`,
  memLineFr(lastMem, ctx.maxHeapMB),
  'Contactez un administrateur pour augmenter la limite ou réduire la concurrence.'
].join('\n')

const oomHostAdmin = (lastMem: MemorySample | null, ctx: DiagnoseContext): string => [
  'Task killed by the OS (SIGKILL, likely container OOM-killer).',
  memLine(lastMem, ctx.maxHeapMB),
  'The container memory limit was probably exceeded.',
  'Mitigation: raise the container memory limit, or lower WORKER_CONCURRENCY.'
].join('\n')

const oomHostUser = (lastMem: MemorySample | null, ctx: DiagnoseContext): string => [
  'Le traitement a été terminé par le système (signal SIGKILL), vraisemblablement à cause d\'un dépassement de la mémoire allouée au conteneur.',
  memLineFr(lastMem, ctx.maxHeapMB),
  'Contactez un administrateur pour augmenter la limite mémoire du conteneur ou réduire la concurrence.'
].join('\n')

const unknownUser = (code: number | null, signal: NodeJS.Signals | null, stderr: string): string => {
  const tail = buildErrorMessageFromStderr(stderr, '')
  const base = `Fin de tâche inattendue (code=${code}, signal=${signal ?? 'null'}).`
  return tail ? `${base} ${tail}` : base
}

export const diagnoseExit = (
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
  lastMem: MemorySample | null,
  ctx: DiagnoseContext
): ExitDiagnosis => {
  if (code === 0 && signal === null) {
    return { category: 'success', adminMessage: '', userMessage: '', logType: 'info' }
  }
  if (signal === 'SIGTERM' || code === 143) {
    return { category: 'sigterm', adminMessage: '', userMessage: '', logType: 'info' }
  }
  // Worker-initiated forceful kill (grace-period escalation). Surface as
  // 'sigterm' so the run lands in status='killed' and we don't blame the
  // OOM-killer. killRun already logs the escalation on the worker side.
  if (ctx.selfKilled && (signal === 'SIGKILL' || code === 137)) {
    return { category: 'sigterm', adminMessage: '', userMessage: '', logType: 'info' }
  }
  if (signal === 'SIGKILL' || code === 137) {
    return {
      category: 'oom-host',
      adminMessage: oomHostAdmin(lastMem, ctx),
      userMessage: oomHostUser(lastMem, ctx),
      logType: 'error'
    }
  }
  if (code === 134 || signal === 'SIGABRT') {
    return {
      category: 'oom-heap',
      adminMessage: oomHeapAdmin(lastMem, ctx),
      userMessage: oomHeapUser(lastMem, ctx),
      logType: 'error'
    }
  }
  if (code === 1) {
    // Plugin error: the stderr text is the plugin's own error message, which
    // is language-agnostic (we don't translate plugin error text). Pass it
    // through to both fields.
    const msg = buildErrorMessageFromStderr(stderr, 'child process exited with code 1')
    return {
      category: 'plugin-error',
      adminMessage: msg,
      userMessage: msg,
      logType: 'error'
    }
  }
  return {
    category: 'unknown',
    adminMessage: `Task ended unexpectedly (code=${code}, signal=${signal ?? 'null'}). ${buildErrorMessageFromStderr(stderr, '')}`.trim(),
    userMessage: unknownUser(code, signal, stderr),
    logType: 'error'
  }
}
