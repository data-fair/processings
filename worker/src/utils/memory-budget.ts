import fs from 'node:fs'

const CGROUP_V2 = '/sys/fs/cgroup/memory.max'
const CGROUP_V1 = '/sys/fs/cgroup/memory/memory.limit_in_bytes'

export type MemoryBudgetInput = {
  hostTotalMB: number
  containerLimitMB: number | null
  workerProcessRssMB: number
  concurrency: number
  taskMaxHeapMB: number
  warnThresholdPct: number
}

export type MemoryBudgetReport = MemoryBudgetInput & {
  effectiveLimitMB: number
  projectedTaskHeapMB: number
  headroomMB: number
  headroomPct: number
  status: 'ok' | 'tight' | 'overbudget'
}

// Reads a cgroup memory.max-style file (or v1 memory.limit_in_bytes). Returns
// MB or null. "max" / unreadable / unparseable / Windows / Mac → null.
export const detectContainerLimitMB = (
  cgroupPath?: string
): number | null => {
  const paths = cgroupPath ? [cgroupPath] : [CGROUP_V2, CGROUP_V1]
  for (const p of paths) {
    try {
      const raw = fs.readFileSync(p, 'utf8').trim()
      if (raw === 'max') return null
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0) {
        if (cgroupPath) return null
        continue
      }
      // Some v1 kernels report a sentinel >= 2^63 - 1 page-aligned value when unlimited
      if (n >= Number.MAX_SAFE_INTEGER) return null
      return Math.round(n / (1024 * 1024))
    } catch {
      if (cgroupPath) return null
      // try next default path
    }
  }
  return null
}

export const computeBudget = (input: MemoryBudgetInput): MemoryBudgetReport => {
  const effectiveLimitMB = input.containerLimitMB === null
    ? input.hostTotalMB
    : Math.min(input.containerLimitMB, input.hostTotalMB)
  const projectedTaskHeapMB = input.concurrency * input.taskMaxHeapMB
  const headroomMB = effectiveLimitMB - input.workerProcessRssMB - projectedTaskHeapMB
  const headroomPct = effectiveLimitMB > 0
    ? Math.round((headroomMB / effectiveLimitMB) * 1000) / 10
    : 0
  let status: MemoryBudgetReport['status']
  if (headroomMB < 0) status = 'overbudget'
  else if (headroomPct < (100 - input.warnThresholdPct)) status = 'tight'
  else status = 'ok'
  return { ...input, effectiveLimitMB, projectedTaskHeapMB, headroomMB, headroomPct, status }
}

export const formatReport = (r: MemoryBudgetReport): string => {
  const container = r.containerLimitMB === null ? 'unknown' : `${r.containerLimitMB}MB`
  const status = r.status.toUpperCase()
  const headSign = r.headroomMB >= 0 ? '+' : ''
  const lines = [
    `[memory-budget] host=${r.hostTotalMB}MB container=${container} effective=${r.effectiveLimitMB}MB worker-rss=${r.workerProcessRssMB}MB`,
    `                concurrency=${r.concurrency} task-max-heap=${r.taskMaxHeapMB}MB projected-task-heap=${r.projectedTaskHeapMB}MB`,
    `                headroom=${headSign}${r.headroomMB}MB (${headSign}${r.headroomPct}%) status=${status}`
  ]
  if (r.status === 'overbudget') {
    lines.push('[memory-budget] WARNING: concurrency × task.maxHeapMB exceeds effective memory limit.')
    lines.push('                Reduce WORKER_CONCURRENCY or WORKER_TASK_MAX_HEAP_MB, or raise the container limit.')
  } else if (r.status === 'tight') {
    lines.push('[memory-budget] WARNING: memory headroom below threshold; consider reducing WORKER_CONCURRENCY or WORKER_TASK_MAX_HEAP_MB.')
  }
  return lines.join('\n')
}
