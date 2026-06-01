import { buildErrorMessageFromStderr } from './worker-operations.ts'
import { toMB, type MemorySample } from './mem-sample.ts'
import type { ExternalSample } from '../task/external-sampler.ts'

export type ExitCategory =
  | 'success' | 'sigterm' | 'oom-heap' | 'oom-host'
  | 'plugin-error' | 'unknown'

export type ExitDiagnosis = {
  category: ExitCategory
  // English text for ops/console/Prometheus context.
  adminMessage: string
  // French text written to run.log (user-facing). Empty for silent categories.
  userMessage: string
  // Resource metrics (RSS / CPU / heap), kept separate from the human-readable
  // cause so the worker can log them as an independent (debug) entry instead of
  // appending them to the error message. Empty when no sample is available.
  adminMetrics: string
  userMetrics: string
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

const extLines = (lastExt: ExternalSample | null): string[] => {
  if (!lastExt) return []
  const out = [`Last seen RSS (external): ${toMB(lastExt.rssBytes)}.`]
  if (lastExt.cpuRatio !== null) {
    out.push(`CPU usage (external): ${lastExt.cpuRatio.toFixed(2)} (1.0 = one full core).`)
  }
  return out
}

const extLinesFr = (lastExt: ExternalSample | null): string[] => {
  if (!lastExt) return []
  const out = [`Dernier RSS observé (parent) : ${toMB(lastExt.rssBytes)}.`]
  if (lastExt.cpuRatio !== null) {
    out.push(`Utilisation CPU (parent) : ${lastExt.cpuRatio.toFixed(2)} (1.0 = un cœur saturé).`)
  }
  return out
}

const oomHeapAdmin = (ctx: DiagnoseContext): string => [
  'Task exceeded the JavaScript heap limit (heap OOM, exit code 134).',
  `Concurrent tasks at exit: ${ctx.runningTasks} / concurrency ${ctx.concurrency}.`,
  `Configuration: WORKER_TASK_MAX_HEAP_MB=${ctx.maxHeapMB}.`,
  'Mitigation: raise WORKER_TASK_MAX_HEAP_MB, lower WORKER_CONCURRENCY, or inspect the plugin for a memory leak.'
].join('\n')

const oomHeapUser = (ctx: DiagnoseContext): string => [
  `Le traitement a dépassé la limite de mémoire (tas JavaScript) allouée à la tâche (${ctx.maxHeapMB}MB).`,
  'Contactez un administrateur pour augmenter la limite ou réduire la concurrence.'
].join('\n')

const oomHostAdmin = (): string => [
  'Task killed by the OS (SIGKILL, likely container OOM-killer).',
  'The container memory limit was probably exceeded.',
  'Mitigation: raise the container memory limit, or lower WORKER_CONCURRENCY.'
].join('\n')

const oomHostUser = (): string => [
  'Le traitement a été terminé par le système (signal SIGKILL), vraisemblablement à cause d\'un dépassement de la mémoire allouée au conteneur.',
  'Contactez un administrateur pour augmenter la limite mémoire du conteneur ou réduire la concurrence.'
].join('\n')

// heap OOM: child-reported heap is primary, external RSS secondary.
const oomHeapMetricsAdmin = (lastMem: MemorySample | null, lastExt: ExternalSample | null, ctx: DiagnoseContext): string =>
  [memLine(lastMem, ctx.maxHeapMB), ...extLines(lastExt)].join('\n')
const oomHeapMetricsUser = (lastMem: MemorySample | null, lastExt: ExternalSample | null, ctx: DiagnoseContext): string =>
  [memLineFr(lastMem, ctx.maxHeapMB), ...extLinesFr(lastExt)].join('\n')

// host OOM: external (parent-observed) RSS is primary, child sample secondary.
const oomHostMetricsAdmin = (lastMem: MemorySample | null, lastExt: ExternalSample | null, ctx: DiagnoseContext): string =>
  [...extLines(lastExt), memLine(lastMem, ctx.maxHeapMB)].join('\n')
const oomHostMetricsUser = (lastMem: MemorySample | null, lastExt: ExternalSample | null, ctx: DiagnoseContext): string =>
  [...extLinesFr(lastExt), memLineFr(lastMem, ctx.maxHeapMB)].join('\n')

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
  lastExt: ExternalSample | null,
  ctx: DiagnoseContext
): ExitDiagnosis => {
  if (code === 0 && signal === null) {
    return { category: 'success', adminMessage: '', userMessage: '', adminMetrics: '', userMetrics: '' }
  }
  if (signal === 'SIGTERM' || code === 143) {
    return { category: 'sigterm', adminMessage: '', userMessage: '', adminMetrics: '', userMetrics: '' }
  }
  // Worker-initiated forceful kill (grace-period escalation). Surface as
  // 'sigterm' so the run lands in status='killed' and we don't blame the
  // OOM-killer. killRun already logs the escalation on the worker side.
  if (ctx.selfKilled && (signal === 'SIGKILL' || code === 137)) {
    return { category: 'sigterm', adminMessage: '', userMessage: '', adminMetrics: '', userMetrics: '' }
  }
  if (signal === 'SIGKILL' || code === 137) {
    return {
      category: 'oom-host',
      adminMessage: oomHostAdmin(),
      userMessage: oomHostUser(),
      adminMetrics: oomHostMetricsAdmin(lastMem, lastExt, ctx),
      userMetrics: oomHostMetricsUser(lastMem, lastExt, ctx)
    }
  }
  if (code === 134 || signal === 'SIGABRT') {
    return {
      category: 'oom-heap',
      adminMessage: oomHeapAdmin(ctx),
      userMessage: oomHeapUser(ctx),
      adminMetrics: oomHeapMetricsAdmin(lastMem, lastExt, ctx),
      userMetrics: oomHeapMetricsUser(lastMem, lastExt, ctx)
    }
  }
  if (code === 1) {
    // Plugin error: the stderr text is the plugin's own error message — keep it
    // verbatim in both fields (plugin owns its language). Resource metrics are
    // reported separately so they don't pollute the plugin's own message.
    const base = buildErrorMessageFromStderr(stderr, 'child process exited with code 1')
    return {
      category: 'plugin-error',
      adminMessage: base,
      userMessage: base,
      adminMetrics: extLines(lastExt).join('\n'),
      userMetrics: extLinesFr(lastExt).join('\n')
    }
  }
  return {
    category: 'unknown',
    adminMessage: `Task ended unexpectedly (code=${code}, signal=${signal ?? 'null'}). ${buildErrorMessageFromStderr(stderr, '')}`.trim(),
    userMessage: unknownUser(code, signal, stderr),
    adminMetrics: extLines(lastExt).join('\n'),
    userMetrics: extLinesFr(lastExt).join('\n')
  }
}
