// Pure helpers for the parent worker to sample per-task RSS and CPU usage
// by reading /proc/<pid>/status (VmRSS) and /proc/<pid>/stat (utime/stime).
// Linux only — isSupported() checks /proc/self/stat at module load.

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
