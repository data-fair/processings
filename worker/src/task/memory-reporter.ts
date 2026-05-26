import type { Processing } from '#api/types'
import { formatMem, type MemorySamplePhase } from '../utils/mem-sample.ts'

type DebugLog = (entry: { type: 'debug', msg: string, extra?: string }) => Promise<void>

const writeStdoutSample = (phase: MemorySamplePhase): void => {
  const m = process.memoryUsage()
  const payload = {
    t: Date.now(),
    phase,
    rss: m.rss,
    heapTotal: m.heapTotal,
    heapUsed: m.heapUsed,
    external: m.external,
    arrayBuffers: m.arrayBuffers
  }
  // Synchronous write; survives process aborts because stdout is piped to parent.
  process.stdout.write(`df-mem:${JSON.stringify(payload)}\n`)
}

export type MemoryReporterHandle = {
  stop: () => void
}

export const startMemoryReporter = (
  processing: Processing,
  debug: DebugLog,
  intervalMs: number
): MemoryReporterHandle => {
  writeStdoutSample('startup')

  let timer: NodeJS.Timeout | null = null
  if (intervalMs > 0) {
    timer = setInterval(() => {
      writeStdoutSample('running')
      if (processing.debug) {
        const m = process.memoryUsage()
        // Best-effort: don't await; mongo serialises per-doc writes.
        debug({
          type: 'debug',
          msg: 'memory',
          extra: formatMem({
            t: Date.now(),
            phase: 'running',
            rss: m.rss,
            heapTotal: m.heapTotal,
            heapUsed: m.heapUsed,
            external: m.external,
            arrayBuffers: m.arrayBuffers
          })
        }).catch(() => { /* best-effort debug log */ })
      }
    }, intervalMs)
    timer.unref()
  }

  const onExit = () => {
    if (timer) { clearInterval(timer); timer = null }
    writeStdoutSample('exit')
  }
  process.on('exit', onExit)

  return {
    stop: () => {
      if (timer) { clearInterval(timer); timer = null }
      process.off('exit', onExit)
    }
  }
}
