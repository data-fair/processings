// Pure helpers for the parent worker to consume the df-mem: stdout protocol
// emitted by task child processes (worker/src/task/memory-reporter.ts).

export type MemorySamplePhase = 'startup' | 'running' | 'exit'

export type MemorySample = {
  t: number
  phase: MemorySamplePhase
  rss: number
  heapTotal: number
  heapUsed: number
  external: number
  arrayBuffers: number
}

const PREFIX = 'df-mem:'
const REQUIRED = ['t', 'phase', 'rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers'] as const
const PHASES: ReadonlySet<string> = new Set(['startup', 'running', 'exit'])

export const parseMemSampleLine = (line: string): MemorySample | null => {
  if (!line.startsWith(PREFIX)) return null
  const body = line.slice(PREFIX.length)
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    return null
  }
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  for (const key of REQUIRED) {
    if (!(key in r)) return null
  }
  if (typeof r.phase !== 'string' || !PHASES.has(r.phase)) return null
  for (const key of ['t', 'rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers'] as const) {
    if (typeof r[key] !== 'number' || !Number.isFinite(r[key])) return null
  }
  return {
    t: r.t as number,
    phase: r.phase as MemorySamplePhase,
    rss: r.rss as number,
    heapTotal: r.heapTotal as number,
    heapUsed: r.heapUsed as number,
    external: r.external as number,
    arrayBuffers: r.arrayBuffers as number
  }
}

export type SplitResult = {
  samples: MemorySample[]
  other: string[]
  residual: string
}

export const splitMemSampleLines = (chunk: string, residual: string): SplitResult => {
  const text = residual + chunk
  const parts = text.split('\n')
  const newResidual = parts.pop() ?? ''
  const samples: MemorySample[] = []
  const other: string[] = []
  for (const line of parts) {
    if (line === '') continue
    if (line.startsWith(PREFIX)) {
      const s = parseMemSampleLine(line)
      if (s) samples.push(s)
      // malformed df-mem lines are silently dropped
    } else {
      other.push(line)
    }
  }
  return { samples, other, residual: newResidual }
}

export const toMB = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1) + 'MB'

export const formatMem = (s: MemorySample): string =>
  `rss=${toMB(s.rss)} heapTotal=${toMB(s.heapTotal)} heapUsed=${toMB(s.heapUsed)} external=${toMB(s.external)} arrayBuffers=${toMB(s.arrayBuffers)}`
