import type { ProcStatSnapshot } from '../utils/proc-stat.ts'
import { readProcStat as defaultReadProcStat, computeCpuRatio, CLOCK_TICKS_PER_SEC } from '../utils/proc-stat.ts'

export type ExternalSample = {
  rssBytes: number
  cpuRatio: number | null
  readAt: number
}

export type ExternalSamplerHandle = { stop: () => void }

type FactoryDeps = {
  readProcStat?: (pid: number) => ProcStatSnapshot | null
  clockTicksPerSec?: number
  updateGauge?: (slot: number, sample: ExternalSample) => void
  logWarn?: (msg: string, err: unknown) => void
}

// Lazy default gauge updater — the import of metrics.ts is deferred to first
// call so that unit tests (which inject updateGauge) never trigger the
// config/mongo side-effects in metrics.ts.
let _defaultUpdateGauge: ((slot: number, sample: ExternalSample) => void) | undefined
const defaultUpdateGauge = async (slot: number, sample: ExternalSample): Promise<void> => {
  if (!_defaultUpdateGauge) {
    const { updateTaskExternalGauges } = await import('../utils/metrics.ts')
    _defaultUpdateGauge = updateTaskExternalGauges
  }
  _defaultUpdateGauge(slot, sample)
}

export const createExternalSamplerFactory = (deps: FactoryDeps = {}) => {
  const reader = deps.readProcStat ?? defaultReadProcStat
  const clockTicksPerSec = deps.clockTicksPerSec ?? CLOCK_TICKS_PER_SEC
  const updateGauge = deps.updateGauge ?? ((slot, sample) => { defaultUpdateGauge(slot, sample).catch(() => {}) })
  const logWarn = deps.logWarn ?? ((msg, err) => console.warn(msg, err))

  return {
    start (
      slot: number,
      pid: number,
      intervalMs: number,
      onSample: (s: ExternalSample) => void
    ): ExternalSamplerHandle {
      let stopped = false
      let timer: NodeJS.Timeout | null = null
      let prev: ProcStatSnapshot | null

      try {
        prev = reader(pid)
      } catch (err) {
        logWarn(`[external-sampler slot=${slot} pid=${pid}] baseline read failed`, err)
        return { stop: () => { stopped = true } }
      }
      if (!prev) return { stop: () => { stopped = true } }

      const emit = (sample: ExternalSample) => {
        try { updateGauge(slot, sample) } catch (err) {
          logWarn(`[external-sampler slot=${slot}] updateGauge threw`, err)
        }
        try { onSample(sample) } catch { /* best-effort */ }
      }

      emit({ rssBytes: prev.rssBytes, cpuRatio: null, readAt: prev.readAt })

      if (intervalMs > 0) {
        timer = setInterval(() => {
          if (stopped) return
          let curr: ProcStatSnapshot | null
          try {
            curr = reader(pid)
          } catch (err) {
            logWarn(`[external-sampler slot=${slot} pid=${pid}] read failed; stopping`, err)
            if (timer) { clearInterval(timer); timer = null }
            return
          }
          if (!curr) {
            if (timer) { clearInterval(timer); timer = null }
            return
          }
          const cpuRatio = computeCpuRatio(prev!, curr, clockTicksPerSec)
          emit({ rssBytes: curr.rssBytes, cpuRatio, readAt: curr.readAt })
          prev = curr
        }, intervalMs)
        timer.unref()
      }

      return {
        stop: () => {
          if (stopped) return
          stopped = true
          if (timer) { clearInterval(timer); timer = null }
        }
      }
    }
  }
}

// Default singleton wired to the real proc-stat reader and gauges.
const defaultFactory = createExternalSamplerFactory()
export const startExternalSampler = defaultFactory.start
