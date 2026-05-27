// Pure helpers for the parent worker to sample per-task RSS and CPU usage
// by reading /proc/<pid>/status (VmRSS) and /proc/<pid>/stat (utime/stime).
// Linux only — isSupported() checks /proc/self/stat at module load.

import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

export type ProcStatSnapshot = {
  rssBytes: number
  utimeTicks: number
  stimeTicks: number
  readAt: number
}

export const parseStatusVmRss = (text: string): number | null => {
  for (const line of text.split('\n')) {
    if (!line.startsWith('VmRSS:')) continue
    const rest = line.slice('VmRSS:'.length).trim()
    // Expect "<integer> kB"
    const m = /^(\d+)\s+kB$/.exec(rest)
    if (!m) return null
    return Number(m[1]) * 1024
  }
  return null
}

export const parseStatFields = (
  text: string
): { utimeTicks: number; stimeTicks: number } | null => {
  // /proc/<pid>/stat contains the process name in parens at field 2. The
  // name may contain spaces, parens, or newlines. Slice from the LAST ')'
  // and split the remainder — fields 3..N are space-separated after that.
  const close = text.lastIndexOf(')')
  if (close < 0) return null
  const after = text.slice(close + 1).trim()
  const fields = after.split(/\s+/)
  // Original spec: field 14 = utime, field 15 = stime. After slicing past
  // ')' we removed fields 1 and 2, so indices are (14-3)=11 and (15-3)=12.
  const utime = Number(fields[11])
  const stime = Number(fields[12])
  if (!Number.isFinite(utime) || !Number.isFinite(stime)) return null
  return { utimeTicks: utime, stimeTicks: stime }
}

const detectClockTicksPerSec = (): number => {
  try {
    const out = execSync('getconf CLK_TCK', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim()
    const n = Number(out)
    if (Number.isFinite(n) && n > 0) return n
  } catch {
    console.info('[proc-stat] getconf CLK_TCK failed, falling back to 100')
  }
  return 100
}

export const CLOCK_TICKS_PER_SEC = detectClockTicksPerSec()

const supported = (() => {
  try {
    return existsSync('/proc/self/stat')
  } catch {
    return false
  }
})()

export const isSupported = (): boolean => supported

export const readProcStat = (pid: number): ProcStatSnapshot | null => {
  if (!supported) return null
  let statusText: string
  let statText: string
  try {
    statusText = readFileSync(`/proc/${pid}/status`, 'utf8')
    statText = readFileSync(`/proc/${pid}/stat`, 'utf8')
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
  const rssBytes = parseStatusVmRss(statusText)
  const ticks = parseStatFields(statText)
  if (rssBytes === null || ticks === null) return null
  return {
    rssBytes,
    utimeTicks: ticks.utimeTicks,
    stimeTicks: ticks.stimeTicks,
    readAt: Date.now()
  }
}

export const computeCpuRatio = (
  prev: Pick<ProcStatSnapshot, 'utimeTicks' | 'stimeTicks' | 'readAt'>,
  curr: Pick<ProcStatSnapshot, 'utimeTicks' | 'stimeTicks' | 'readAt'>,
  clockTicksPerSec: number
): number => {
  const dCpuTicks = (curr.utimeTicks + curr.stimeTicks) - (prev.utimeTicks + prev.stimeTicks)
  const dWallMs = curr.readAt - prev.readAt
  if (dCpuTicks < 0 || dWallMs <= 0 || clockTicksPerSec <= 0) return 0
  const cpuSeconds = dCpuTicks / clockTicksPerSec
  const wallSeconds = dWallMs / 1000
  return cpuSeconds / wallSeconds
}
