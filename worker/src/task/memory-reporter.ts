import type { Processing } from '#api/types'
import { formatMem, type MemorySample, type MemorySamplePhase } from '../utils/mem-sample.ts'

type DebugLog = (msg: string, extra?: string) => Promise<void>

const MEMORY_LOG_LABEL = 'Task process memory stats'

const buildSample = (phase: MemorySamplePhase): MemorySample => {
  const m = process.memoryUsage()
  return {
    t: Date.now(),
    phase,
    rss: m.rss,
    heapTotal: m.heapTotal,
    heapUsed: m.heapUsed,
    external: m.external,
    arrayBuffers: m.arrayBuffers
  }
}

const writeStdoutSample = (sample: MemorySample): void => {
  // Synchronous write; survives process aborts because stdout is piped to parent.
  process.stdout.write(`df-mem:${JSON.stringify(sample)}\n`)
}

export type MemoryReporterHandle = {
  stop: () => Promise<void>
}

export const startMemoryReporter = (
  processing: Processing,
  debug: DebugLog,
  intervalMs: number
): MemoryReporterHandle => {
  const startupSample = buildSample('startup')
  writeStdoutSample(startupSample)
  if (processing.debug) {
    debug(`${MEMORY_LOG_LABEL} - ${formatMem(startupSample)}`).catch(() => { /* best-effort */ })
  }

  let timer: NodeJS.Timeout | null = null
  if (intervalMs > 0) {
    timer = setInterval(() => {
      const sample = buildSample('running')
      writeStdoutSample(sample)
      if (processing.debug) {
        // Skip building the debug string when debug is off
        // (log.debug also no-ops, but avoids formatMem cost).
        debug(`${MEMORY_LOG_LABEL} - ${formatMem(sample)}`).catch(() => { /* best-effort */ })
      }
    }, intervalMs)
    timer.unref()
  }

  const onExit = () => {
    if (timer) { clearInterval(timer); timer = null }
    writeStdoutSample(buildSample('exit'))
  }
  process.on('exit', onExit)

  return {
    stop: async () => {
      if (timer) { clearInterval(timer); timer = null }
      process.off('exit', onExit)
      const exitSample = buildSample('exit')
      writeStdoutSample(exitSample)
      if (processing.debug) {
        await debug(`${MEMORY_LOG_LABEL} - ${formatMem(exitSample)}`).catch(() => { /* best-effort */ })
      }
    }
  }
}
