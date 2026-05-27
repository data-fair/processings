# External Task Resource Sampler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect per-task RSS and CPU metrics from the parent worker process by reading `/proc/<pid>`, so observation survives CPU-bound plugins saturating the child's event loop.

**Architecture:** Pure utility `proc-stat.ts` reads `/proc/<pid>/status` + `/proc/<pid>/stat`. A new `external-sampler.ts` owns a per-slot `setInterval` in the parent, computes CPU% via delta of utime/stime ticks, and writes the existing per-slot RSS gauge plus a new CPU-ratio gauge. The in-process `df-mem` reporter stays for V8-internal heap counters but stops writing RSS. Linux only — non-Linux logs a one-line skip notice at boot.

**Tech Stack:** Node.js / TypeScript, `prom-client`, Playwright tests, `/proc` filesystem (Linux).

**Spec:** [`docs/superpowers/specs/2026-05-27-external-task-resource-sampler-design.md`](../specs/2026-05-27-external-task-resource-sampler-design.md)

---

## File Map

| Path | Status | Responsibility |
|---|---|---|
| `worker/src/utils/proc-stat.ts` | Create | Pure procfs parser + CPU ratio math + CLK_TCK detection |
| `worker/src/task/external-sampler.ts` | Create | Per-slot timer, baseline + tick lifecycle, gauge updates |
| `worker/src/utils/metrics.ts` | Modify | Add `cpuRatioGauge`, `updateTaskExternalGauges`, gate RSS write in `updateTaskMemoryGauges` |
| `worker/src/utils/exit-code.ts` | Modify | Accept `lastExt`, render external RSS / CPU% in admin/user messages |
| `worker/src/worker.ts` | Modify | Wire sampler into `iter()` lifecycle, plumb `lastExt` into `diagnoseExit` |
| `worker/config/default.mjs` | Modify | Add `worker.task.externalSamplerEnabled: true` |
| `worker/config/custom-environment-variables.mjs` | Modify | Add `WORKER_TASK_EXTERNAL_SAMPLER_ENABLED` binding |
| `worker/config/type/schema.json` | Modify | Document `externalSamplerEnabled` property |
| `docs/architecture/memory-management.md` | Modify | Document external sampler subsection + metric semantics shift |
| `tests/features/worker-utils/proc-stat.unit.spec.ts` | Create | Parser + CPU math + isSupported unit tests |
| `tests/features/worker-utils/external-sampler.unit.spec.ts` | Create | Sampler lifecycle unit tests (DI-injected reader) |
| `tests/features/worker-utils/exit-code.unit.spec.ts` | Modify | Add `lastExt` cases for oom-host / oom-heap |
| `tests/features/processings/memory-oom.e2e.spec.ts` | Modify | Add "CPU-saturated task still reports RSS" case |
| `tests/fixtures/processing-cpu-leak/index.js` | Create | Busy-loop + allocate fixture for e2e |
| `tests/fixtures/processing-cpu-leak/package.json` | Create | Plugin manifest |
| `tests/fixtures/processing-cpu-leak/processing-config-schema.json` | Create | Empty config schema |

---

## Task 1: Pure procfs reader — `parseStatusVmRss` and `parseStatFields`

**Files:**
- Create: `worker/src/utils/proc-stat.ts`
- Test: `tests/features/worker-utils/proc-stat.unit.spec.ts`

The parsers are pure string→number functions, so we start by writing tests then the minimal parser. No fs reads in this task.

- [ ] **Step 1: Write failing tests for parsers**

Create `tests/features/worker-utils/proc-stat.unit.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import {
  parseStatusVmRss,
  parseStatFields
} from '../../../worker/src/utils/proc-stat.ts'

test.describe('parseStatusVmRss', () => {
  test('parses VmRSS line in kB', () => {
    const status = [
      'Name:\tnode',
      'Umask:\t0022',
      'State:\tS (sleeping)',
      'VmPeak:\t  123456 kB',
      'VmRSS:\t   12345 kB',
      'VmData:\t   2000 kB'
    ].join('\n')
    expect(parseStatusVmRss(status)).toBe(12345 * 1024)
  })

  test('returns null when VmRSS line is missing', () => {
    expect(parseStatusVmRss('Name:\tnode\nState:\tS')).toBeNull()
  })

  test('returns null when value is malformed', () => {
    expect(parseStatusVmRss('VmRSS:\tnot-a-number kB')).toBeNull()
  })

  test('returns null when unit is not kB', () => {
    expect(parseStatusVmRss('VmRSS:\t12345 MB')).toBeNull()
  })
})

test.describe('parseStatFields', () => {
  test('parses a simple stat line', () => {
    const stat = '1234 (node) S 5678 1234 1234 0 -1 4194304 100 0 0 0 50 25 0 0 20 0 1 0 999 ...'
    const out = parseStatFields(stat)
    expect(out).toEqual({ utimeTicks: 50, stimeTicks: 25 })
  })

  test('handles a process name containing spaces and parens', () => {
    const stat = '1234 (weird (name with) spaces) S 5678 1234 1234 0 -1 4194304 100 0 0 0 7 3 0 0 20 0 1 0 999 ...'
    const out = parseStatFields(stat)
    expect(out).toEqual({ utimeTicks: 7, stimeTicks: 3 })
  })

  test('handles a process name containing a newline', () => {
    const stat = '1234 (line1\nline2) S 5678 1234 1234 0 -1 4194304 100 0 0 0 11 13 0 0 20 0 1 0 999 ...'
    const out = parseStatFields(stat)
    expect(out).toEqual({ utimeTicks: 11, stimeTicks: 13 })
  })

  test('returns null when there is no closing paren', () => {
    expect(parseStatFields('1234 (no-end S 5678')).toBeNull()
  })

  test('returns null when ticks fields are non-numeric', () => {
    const stat = '1234 (node) S 5678 1234 1234 0 -1 4194304 100 0 0 0 x y 0 0 20 0 1 0 999'
    expect(parseStatFields(stat)).toBeNull()
  })
})
```

- [ ] **Step 2: Verify tests fail**

Run: `npx playwright test tests/features/worker-utils/proc-stat.unit.spec.ts --reporter=list`
Expected: all tests fail — module does not exist.

- [ ] **Step 3: Create `proc-stat.ts` with the parsers**

Create `worker/src/utils/proc-stat.ts`:

```ts
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
    const kB = Number(m[1])
    if (!Number.isFinite(kB)) return null
    return kB * 1024
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
```

- [ ] **Step 4: Verify parser tests pass**

Run: `npx playwright test tests/features/worker-utils/proc-stat.unit.spec.ts --reporter=list`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/utils/proc-stat.ts tests/features/worker-utils/proc-stat.unit.spec.ts
git commit -m "$(cat <<'EOF'
feat(worker): proc-stat parsers for /proc/<pid>/status and stat

Pure string→number helpers. /proc/<pid>/stat parser slices from the last
')' to handle process names containing spaces, parens, or newlines.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `readProcStat`, `computeCpuRatio`, `isSupported`, CLK_TCK detection

**Files:**
- Modify: `worker/src/utils/proc-stat.ts`
- Modify: `tests/features/worker-utils/proc-stat.unit.spec.ts`

Wire the parsers to actual fs reads, add CPU math, and detect CLK_TCK once at module load with a fallback to 100.

- [ ] **Step 1: Write failing tests**

Append to `tests/features/worker-utils/proc-stat.unit.spec.ts`:

```ts
import {
  readProcStat,
  computeCpuRatio,
  isSupported,
  CLOCK_TICKS_PER_SEC
} from '../../../worker/src/utils/proc-stat.ts'

test.describe('isSupported', () => {
  test('returns true on Linux', () => {
    if (process.platform !== 'linux') test.skip()
    expect(isSupported()).toBe(true)
  })

  test('returns false on non-Linux', () => {
    if (process.platform === 'linux') test.skip()
    expect(isSupported()).toBe(false)
  })
})

test.describe('readProcStat', () => {
  test('returns plausible snapshot for the current process on Linux', () => {
    if (process.platform !== 'linux') test.skip()
    const s = readProcStat(process.pid)
    expect(s).not.toBeNull()
    expect(s!.rssBytes).toBeGreaterThan(1024 * 1024) // at least 1 MB
    expect(s!.utimeTicks).toBeGreaterThanOrEqual(0)
    expect(s!.stimeTicks).toBeGreaterThanOrEqual(0)
    expect(s!.readAt).toBeGreaterThan(0)
  })

  test('returns null for a non-existent pid', () => {
    if (process.platform !== 'linux') test.skip()
    expect(readProcStat(999999999)).toBeNull()
  })
})

test.describe('computeCpuRatio', () => {
  const ticksPerSec = 100

  test('one core fully saturated returns ~1.0', () => {
    const prev = { utimeTicks: 0, stimeTicks: 0, readAt: 0 }
    const curr = { utimeTicks: 80, stimeTicks: 20, readAt: 1000 } // 100 ticks / 1 s
    expect(computeCpuRatio(prev, curr, ticksPerSec)).toBeCloseTo(1.0, 3)
  })

  test('idle process returns 0', () => {
    const prev = { utimeTicks: 50, stimeTicks: 50, readAt: 0 }
    const curr = { utimeTicks: 50, stimeTicks: 50, readAt: 1000 }
    expect(computeCpuRatio(prev, curr, ticksPerSec)).toBe(0)
  })

  test('two cores saturated returns ~2.0', () => {
    const prev = { utimeTicks: 0, stimeTicks: 0, readAt: 0 }
    const curr = { utimeTicks: 200, stimeTicks: 0, readAt: 1000 }
    expect(computeCpuRatio(prev, curr, ticksPerSec)).toBeCloseTo(2.0, 3)
  })

  test('zero wall delta returns 0', () => {
    const prev = { utimeTicks: 0, stimeTicks: 0, readAt: 1000 }
    const curr = { utimeTicks: 50, stimeTicks: 0, readAt: 1000 }
    expect(computeCpuRatio(prev, curr, ticksPerSec)).toBe(0)
  })

  test('negative wall delta returns 0 (clock skew defence)', () => {
    const prev = { utimeTicks: 0, stimeTicks: 0, readAt: 2000 }
    const curr = { utimeTicks: 50, stimeTicks: 0, readAt: 1000 }
    expect(computeCpuRatio(prev, curr, ticksPerSec)).toBe(0)
  })

  test('negative cpu delta returns 0', () => {
    const prev = { utimeTicks: 100, stimeTicks: 100, readAt: 0 }
    const curr = { utimeTicks: 50, stimeTicks: 50, readAt: 1000 }
    expect(computeCpuRatio(prev, curr, ticksPerSec)).toBe(0)
  })
})

test.describe('CLOCK_TICKS_PER_SEC', () => {
  test('is a positive number', () => {
    expect(CLOCK_TICKS_PER_SEC).toBeGreaterThan(0)
  })

  test('is 100 or another sensible kernel HZ value', () => {
    // Defensive: distros use 100, 250, 300, or 1000. Fallback is 100.
    expect([100, 250, 300, 1000]).toContain(CLOCK_TICKS_PER_SEC)
  })
})
```

- [ ] **Step 2: Verify new tests fail**

Run: `npx playwright test tests/features/worker-utils/proc-stat.unit.spec.ts --reporter=list`
Expected: new tests fail — exports missing.

- [ ] **Step 3: Extend `proc-stat.ts` with fs reads, CPU math, and CLK_TCK**

Append to `worker/src/utils/proc-stat.ts`:

```ts
const detectClockTicksPerSec = (): number => {
  try {
    const out = execSync('getconf CLK_TCK', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim()
    const n = Number(out)
    if (Number.isFinite(n) && n > 0) return n
  } catch {
    // fall through
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
  if (dCpuTicks < 0 || dWallMs <= 0) return 0
  const cpuSeconds = dCpuTicks / clockTicksPerSec
  const wallSeconds = dWallMs / 1000
  return cpuSeconds / wallSeconds
}
```

- [ ] **Step 4: Run all proc-stat tests**

Run: `npx playwright test tests/features/worker-utils/proc-stat.unit.spec.ts --reporter=list`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/utils/proc-stat.ts tests/features/worker-utils/proc-stat.unit.spec.ts
git commit -m "$(cat <<'EOF'
feat(worker): procfs reader, CPU ratio math, CLK_TCK detection

Adds readProcStat (fs-backed), computeCpuRatio (delta math), isSupported
(/proc gate). CLK_TCK is detected once via 'getconf CLK_TCK' with a
fallback to 100.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Per-slot external sampler — `external-sampler.ts`

**Files:**
- Create: `worker/src/task/external-sampler.ts`
- Test: `tests/features/worker-utils/external-sampler.unit.spec.ts`

The sampler owns one timer per slot and tracks the previous `ProcStatSnapshot` so each tick can compute CPU%. Inject the reader via factory so the tests don't need real `/proc` access.

- [ ] **Step 1: Write failing tests**

Create `tests/features/worker-utils/external-sampler.unit.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import {
  createExternalSamplerFactory,
  type ExternalSample
} from '../../../worker/src/task/external-sampler.ts'
import type { ProcStatSnapshot } from '../../../worker/src/utils/proc-stat.ts'

// Stubs for the metrics gauge writer (just collect calls).
const collectingGauges = () => {
  const calls: Array<{ slot: number; sample: ExternalSample }> = []
  return {
    calls,
    update: (slot: number, sample: ExternalSample) => { calls.push({ slot, sample }) }
  }
}

const snap = (utime: number, stime: number, rss: number, readAt: number): ProcStatSnapshot =>
  ({ utimeTicks: utime, stimeTicks: stime, rssBytes: rss, readAt })

test('baseline tick emits RSS with cpuRatio: null', () => {
  const reader = (_pid: number) => snap(0, 0, 50 * 1024 * 1024, 1000)
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 0, (s) => samples.push(s))
  expect(samples).toHaveLength(1)
  expect(samples[0].rssBytes).toBe(50 * 1024 * 1024)
  expect(samples[0].cpuRatio).toBeNull()
  expect(gauges.calls).toHaveLength(1)
  handle.stop()
})

test('returns no-op handle when baseline read returns null', () => {
  const reader = (_pid: number) => null
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 100, (s) => samples.push(s))
  expect(samples).toHaveLength(0)
  expect(gauges.calls).toHaveLength(0)
  expect(() => handle.stop()).not.toThrow()
})

test('second tick computes cpuRatio against baseline', async () => {
  const queue: ProcStatSnapshot[] = [
    snap(0, 0, 50 * 1024 * 1024, 1000),
    snap(80, 20, 60 * 1024 * 1024, 2000) // 100 ticks / 1s @ 100 Hz = 1.0
  ]
  const reader = (_pid: number) => queue.shift() ?? null
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 10, (s) => samples.push(s))
  // Wait for one timer tick
  await new Promise(resolve => setTimeout(resolve, 30))
  handle.stop()
  expect(samples.length).toBeGreaterThanOrEqual(2)
  expect(samples[0].cpuRatio).toBeNull()
  expect(samples[1].cpuRatio).toBeCloseTo(1.0, 3)
})

test('reader returning null mid-stream stops the sampler', async () => {
  const queue: (ProcStatSnapshot | null)[] = [
    snap(0, 0, 50 * 1024 * 1024, 1000),
    null,
    snap(999, 999, 999 * 1024 * 1024, 9999) // should NEVER be read
  ]
  const reader = (_pid: number) => queue.shift() ?? null
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 10, (s) => samples.push(s))
  await new Promise(resolve => setTimeout(resolve, 50))
  handle.stop()
  expect(samples).toHaveLength(1) // only the baseline
})

test('intervalMs <= 0 emits baseline only, no timer', async () => {
  let calls = 0
  const reader = (_pid: number) => { calls++; return snap(0, 0, 50 * 1024 * 1024, 1000) }
  const gauges = collectingGauges()
  const samples: ExternalSample[] = []
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 0, (s) => samples.push(s))
  await new Promise(resolve => setTimeout(resolve, 30))
  handle.stop()
  expect(samples).toHaveLength(1)
  expect(calls).toBe(1)
})

test('onSample callback throwing does not crash the sampler', async () => {
  const queue: ProcStatSnapshot[] = [
    snap(0, 0, 50 * 1024 * 1024, 1000),
    snap(10, 10, 60 * 1024 * 1024, 2000)
  ]
  const reader = (_pid: number) => queue.shift() ?? null
  const gauges = collectingGauges()
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 10, () => { throw new Error('boom') })
  await new Promise(resolve => setTimeout(resolve, 30))
  // If we got here without an unhandled rejection, the sampler swallowed it.
  expect(gauges.calls.length).toBeGreaterThanOrEqual(1)
  handle.stop()
})

test('stop() is idempotent', () => {
  const reader = (_pid: number) => snap(0, 0, 50 * 1024 * 1024, 1000)
  const gauges = collectingGauges()
  const factory = createExternalSamplerFactory({
    readProcStat: reader,
    clockTicksPerSec: 100,
    updateGauge: gauges.update
  })
  const handle = factory.start(0, 1234, 10, () => {})
  handle.stop()
  expect(() => handle.stop()).not.toThrow()
})
```

- [ ] **Step 2: Verify tests fail**

Run: `npx playwright test tests/features/worker-utils/external-sampler.unit.spec.ts --reporter=list`
Expected: all tests fail — module does not exist.

- [ ] **Step 3: Create `external-sampler.ts`**

Create `worker/src/task/external-sampler.ts`:

```ts
import type { ProcStatSnapshot } from '../utils/proc-stat.ts'
import { readProcStat as defaultReadProcStat, computeCpuRatio, CLOCK_TICKS_PER_SEC } from '../utils/proc-stat.ts'
import { updateTaskExternalGauges } from '../utils/metrics.ts'

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

export const createExternalSamplerFactory = (deps: FactoryDeps = {}) => {
  const reader = deps.readProcStat ?? defaultReadProcStat
  const clockTicksPerSec = deps.clockTicksPerSec ?? CLOCK_TICKS_PER_SEC
  const updateGauge = deps.updateGauge ?? updateTaskExternalGauges
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
```

- [ ] **Step 4: Stub `updateTaskExternalGauges` in metrics.ts so the import resolves**

Open `worker/src/utils/metrics.ts` and **temporarily** add at the bottom (will be replaced in Task 4):

```ts
// Stub for Task 3; replaced with real implementation in Task 4.
export const updateTaskExternalGauges = (_slot: number, _sample: { rssBytes: number; cpuRatio: number | null; readAt: number }): void => {}
```

- [ ] **Step 5: Verify sampler tests pass**

Run: `npx playwright test tests/features/worker-utils/external-sampler.unit.spec.ts --reporter=list`
Expected: all 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add worker/src/task/external-sampler.ts worker/src/utils/metrics.ts tests/features/worker-utils/external-sampler.unit.spec.ts
git commit -m "$(cat <<'EOF'
feat(worker): per-slot external resource sampler

Owns a setInterval per slot in the parent, snapshots /proc/<pid> via the
injectable readProcStat, computes CPU ratio against a previous snapshot
and exposes the result through an onSample callback. Stops itself when
the reader returns null (PID gone) or throws.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire RSS + CPU gauges into `metrics.ts`

**Files:**
- Modify: `worker/src/utils/metrics.ts`

Add the real `cpuRatioGauge`, real `updateTaskExternalGauges`, and a boot-time toggle (`setExternalRssActive`) that gates RSS writes from the in-process path.

- [ ] **Step 1: Open metrics.ts and locate the existing gauges**

Run: `grep -n "Gauge\|updateTaskMemoryGauges" worker/src/utils/metrics.ts`

You should see the four `*Gauge` definitions and `updateTaskMemoryGauges` around lines 19-64.

- [ ] **Step 2: Replace the stub `updateTaskExternalGauges` with the real implementation**

In `worker/src/utils/metrics.ts`, delete the stub from Task 3 and add (place near the other gauges and update helpers):

```ts
const cpuRatioGauge = new Gauge({
  name: 'df_processings_process_cpu_usage_ratio',
  help: 'Per-process CPU usage as a fraction of one core over the last sample window (1.0 = one full core)',
  labelNames: ['kind', 'slot']
})

// Flipped to true at worker boot when the external sampler is active.
// When true, the in-process df-mem writer skips rssGauge so the
// external sampler is the sole RSS authority for kind="task".
let externalRssActive = false
export const setExternalRssActive = (active: boolean): void => {
  externalRssActive = active
}

import type { ExternalSample } from '../task/external-sampler.ts'

export const updateTaskExternalGauges = (slot: number, ext: ExternalSample): void => {
  const labels = { kind: 'task', slot: String(slot) }
  rssGauge.set(labels, ext.rssBytes)
  if (ext.cpuRatio !== null) {
    cpuRatioGauge.set(labels, ext.cpuRatio)
  }
}
```

- [ ] **Step 3: Gate the in-process RSS write**

In the same file, change `updateTaskMemoryGauges` from:

```ts
export const updateTaskMemoryGauges = (slot: number, sample: MemorySample): void => {
  const labels = { kind: 'task', slot: String(slot) }
  rssGauge.set(labels, sample.rss)
  heapTotalGauge.set(labels, sample.heapTotal)
  heapUsedGauge.set(labels, sample.heapUsed)
  externalGauge.set(labels, sample.external)
}
```

…to:

```ts
export const updateTaskMemoryGauges = (slot: number, sample: MemorySample): void => {
  const labels = { kind: 'task', slot: String(slot) }
  // External sampler is the authoritative RSS writer when active; skip
  // RSS here to avoid two writers thrashing on the same gauge.
  if (!externalRssActive) rssGauge.set(labels, sample.rss)
  heapTotalGauge.set(labels, sample.heapTotal)
  heapUsedGauge.set(labels, sample.heapUsed)
  externalGauge.set(labels, sample.external)
}
```

- [ ] **Step 4: Verify build / typecheck**

Run: `npm run check-types`
Expected: passes with no errors. (If `import type { ExternalSample }` causes a circular type warning, move the `ExternalSample` type into `worker/src/utils/proc-stat.ts` or a shared `worker/src/utils/sampling-types.ts` and re-import from both ends.)

- [ ] **Step 5: Re-run all worker-utils unit tests**

Run: `npx playwright test tests/features/worker-utils/ --reporter=list`
Expected: all tests still pass (proc-stat, mem-sample, exit-code, memory-budget, external-sampler).

- [ ] **Step 6: Commit**

```bash
git add worker/src/utils/metrics.ts
git commit -m "$(cat <<'EOF'
feat(worker): cpu-ratio gauge and external-sample writer

Adds df_processings_process_cpu_usage_ratio (gauge, labels kind/slot)
and updateTaskExternalGauges. Introduces externalRssActive boot toggle:
when true, the in-process updateTaskMemoryGauges skips rssGauge so the
external sampler is the sole RSS authority for kind="task".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Config knob — `externalSamplerEnabled`

**Files:**
- Modify: `worker/config/default.mjs`
- Modify: `worker/config/custom-environment-variables.mjs`
- Modify: `worker/config/type/schema.json`

- [ ] **Step 1: Edit `worker/config/default.mjs`**

In the `worker.task` object, add the new key. The block becomes:

```js
task: {
  // Max V8 old-generation heap for each task child process, in MB.
  // Passed as --max-old-space-size to the spawned child. Defaults to
  // V8's own default for this host (see nodeDefaultTaskMaxHeapMB above).
  maxHeapMB: nodeDefaultTaskMaxHeapMB,
  // interval at which the child task samples process.memoryUsage()
  // and writes both a df-mem: stdout line (parent updates gauges) and,
  // when processing.debug is true, a debug entry in run.log.
  // Set to 0 to disable periodic sampling (exit-time sample still emitted).
  memorySampleIntervalMs: 10000,
  // Startup sanity check warns when projected concurrency*maxHeapMB heap
  // leaves less than this percent of effective memory as headroom.
  memoryHeadroomWarnPct: 30,
  // Parent-side resource sampler: reads /proc/<pid> at memorySampleIntervalMs
  // for each task child. Becomes the authoritative writer for the per-slot
  // RSS gauge (the in-process df-mem RSS write is suppressed). Auto-disabled
  // at boot on non-Linux platforms.
  externalSamplerEnabled: true
}
```

- [ ] **Step 2: Edit `worker/config/custom-environment-variables.mjs`**

In the `worker.task` block, add the env var line:

```js
task: {
  maxHeapMB: 'WORKER_TASK_MAX_HEAP_MB',
  memorySampleIntervalMs: 'WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS',
  memoryHeadroomWarnPct: 'WORKER_TASK_MEMORY_HEADROOM_WARN_PCT',
  externalSamplerEnabled: {
    __name: 'WORKER_TASK_EXTERNAL_SAMPLER_ENABLED',
    __format: 'json'
  }
}
```

(The `__format: 'json'` ensures `WORKER_TASK_EXTERNAL_SAMPLER_ENABLED=false` is parsed as a boolean — node-config's bare string→boolean coercion is unreliable.)

- [ ] **Step 3: Edit `worker/config/type/schema.json`**

Find the `worker.task` block (around line 152). Update `required` and `properties`:

```json
"task": {
  "type": "object",
  "required": ["maxHeapMB", "memorySampleIntervalMs", "memoryHeadroomWarnPct", "externalSamplerEnabled"],
  "properties": {
    "maxHeapMB": { "type": "number", "minimum": 64, "description": "Per-task V8 old-space heap cap in MB, passed as --max-old-space-size to the child. Defaults to V8's own heap_size_limit for the host." },
    "memorySampleIntervalMs": { "type": "number", "minimum": 0 },
    "memoryHeadroomWarnPct": { "type": "number", "minimum": 0, "maximum": 100 },
    "externalSamplerEnabled": { "type": "boolean", "description": "Enable parent-side /proc-based RSS/CPU sampler for each task child. Auto-disabled at boot on non-Linux platforms." }
  }
}
```

- [ ] **Step 4: Regenerate config types**

Run: `npm run build-types`
Expected: completes without error. New `externalSamplerEnabled` field appears in generated types.

- [ ] **Step 5: Typecheck**

Run: `npm run check-types`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add worker/config/default.mjs worker/config/custom-environment-variables.mjs worker/config/type/schema.json
git commit -m "$(cat <<'EOF'
chore(worker): add externalSamplerEnabled config + env binding

Default: true. Bound to WORKER_TASK_EXTERNAL_SAMPLER_ENABLED with JSON
parsing so 'false' is correctly coerced to a boolean.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire sampler into `worker.ts::iter()`

**Files:**
- Modify: `worker/src/worker.ts`

Three changes: (a) toggle `setExternalRssActive` at boot once we know whether the platform supports it and the config allows it, (b) start the sampler after the child is spawned, (c) stop it on close and on spawn error and plumb `lastExt` into `diagnoseExit` (the parameter is added in Task 7 — this task passes it through using a context object so the signature change in Task 7 is mechanical).

- [ ] **Step 1: Update imports**

In `worker/src/worker.ts`, change the existing imports to add the new pieces:

```ts
import { initMetrics, updateTaskMemoryGauges, updateWorkerMemoryGauges, setSlotState, recordExit, setExternalRssActive } from './utils/metrics.ts'
```

…and add:

```ts
import { startExternalSampler, type ExternalSample } from './task/external-sampler.ts'
import { isSupported as procStatIsSupported } from './utils/proc-stat.ts'
```

- [ ] **Step 2: Add module-level `externalSamplerActive` and flip it at boot**

`iter()` lives in the same module as `start()`, so a module-level `let` is the simplest way to share the value without restructuring.

Near the top of `worker/src/worker.ts`, with the other module-level declarations (near `const promisePool…`, `const pids…`, `const selfKilled…`):

```ts
let externalSamplerActive = false
```

Inside `start()`, just before the existing `updateWorkerMemoryGauges()` call:

```ts
externalSamplerActive = config.worker.task.externalSamplerEnabled && procStatIsSupported()
setExternalRssActive(externalSamplerActive)
if (config.worker.task.externalSamplerEnabled && !procStatIsSupported()) {
  console.warn('[external-sampler] disabled: /proc is not available on this platform')
} else if (externalSamplerActive) {
  console.log('[external-sampler] enabled: per-slot RSS/CPU sampled from /proc')
}
```

- [ ] **Step 3: Start the sampler in `iter()`**

In `iter()`, right after this existing block:

```ts
pids[run._id] = child.pid || -1
setSlotState(freeSlot, true)
```

Add:

```ts
let lastExt: ExternalSample | null = null
const sampler = (child.pid && externalSamplerActive)
  ? startExternalSampler(freeSlot, child.pid, config.worker.task.memorySampleIntervalMs, (ext) => { lastExt = ext })
  : null
```

- [ ] **Step 4: Stop the sampler on close and error**

Replace the existing close/error Promise block:

```ts
await new Promise<void>((resolve, reject) => {
  child.on('close', (code, signal) => {
    setSlotState(freeSlot, false)
    if (code === 0 && signal === null) resolve()
    else {
      const err: any = new Error(`child process exited (code=${code}, signal=${signal ?? 'null'})`)
      err.code = code
      err.signal = signal
      reject(err)
    }
  })
  child.on('error', reject)
})
```

…with:

```ts
await new Promise<void>((resolve, reject) => {
  child.on('close', (code, signal) => {
    sampler?.stop()
    setSlotState(freeSlot, false)
    if (code === 0 && signal === null) resolve()
    else {
      const err: any = new Error(`child process exited (code=${code}, signal=${signal ?? 'null'})`)
      err.code = code
      err.signal = signal
      reject(err)
    }
  })
  child.on('error', (err) => {
    sampler?.stop()
    reject(err)
  })
})
```

- [ ] **Step 5: Plumb `lastExt` into `diagnoseExit`**

In the existing `catch (err: any)` block of `iter()`, change the `diagnoseExit` call. The current call is:

```ts
const diag: ExitDiagnosis = diagnoseExit(
  err.code ?? null,
  (err.signal ?? null) as NodeJS.Signals | null,
  stderr,
  lastMem,
  {
    maxHeapMB: config.worker.task.maxHeapMB,
    concurrency: config.worker.concurrency,
    runningTasks,
    selfKilled: selfKilled.has(run._id)
  }
)
```

Change it to:

```ts
const diag: ExitDiagnosis = diagnoseExit(
  err.code ?? null,
  (err.signal ?? null) as NodeJS.Signals | null,
  stderr,
  lastMem,
  lastExt,
  {
    maxHeapMB: config.worker.task.maxHeapMB,
    concurrency: config.worker.concurrency,
    runningTasks,
    selfKilled: selfKilled.has(run._id)
  }
)
```

(The `diagnoseExit` signature change happens in Task 7 — this build will fail typecheck until Task 7 lands. That's fine; commit them sequentially.)

- [ ] **Step 6: Commit (typecheck deferred until Task 7)**

Skip typecheck on this task — the build is broken on purpose between Task 6 and Task 7 (atomic refactor). Commit anyway:

```bash
git add worker/src/worker.ts
git commit -m "$(cat <<'EOF'
feat(worker): wire external sampler into iter() lifecycle

Starts a per-slot proc-stat sampler immediately after spawn, stops it
on close and on spawn error. Passes the last external sample through
to diagnoseExit (signature updated in the next commit). Activates
setExternalRssActive at boot when the platform supports /proc and the
feature flag is on.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Render external RSS / CPU% in `diagnoseExit`

**Files:**
- Modify: `worker/src/utils/exit-code.ts`
- Modify: `tests/features/worker-utils/exit-code.unit.spec.ts`

Extend `diagnoseExit` to accept `lastExt` and weave it into the admin/user message text.

- [ ] **Step 1: Write failing tests**

Open `tests/features/worker-utils/exit-code.unit.spec.ts` and add at the top after the existing `sample` constant:

```ts
import type { ExternalSample } from '../../../worker/src/task/external-sampler.ts'

const ext: ExternalSample = {
  rssBytes: 815 * 1024 * 1024,
  cpuRatio: 0.92,
  readAt: 1700000000000
}
```

Update every existing `diagnoseExit(...)` call in this file to insert `null` as the new 5th argument (lastExt) — between the existing `sample`/`null` lastMem and the `ctx`. Example:

```ts
const d = diagnoseExit(0, null, '', null, null, ctx)
```

Then append new test cases at the end of the file:

```ts
test('oom-host with lastExt includes external RSS and CPU ratio in admin', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, ext, ctx)
  expect(d.category).toBe('oom-host')
  expect(d.adminMessage).toMatch(/Last seen RSS \(external\):\s*815\.0MB/)
  expect(d.adminMessage).toMatch(/CPU usage \(external\):\s*0\.92/)
})

test('oom-host without lastExt falls back to legacy message', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, null, ctx)
  expect(d.category).toBe('oom-host')
  expect(d.adminMessage).not.toContain('external')
  expect(d.adminMessage).toContain('Task killed by the OS')
  expect(d.adminMessage).toContain('RSS: 812.0MB')
})

test('oom-heap with both lastMem and lastExt renders heap primary, external secondary', () => {
  const d = diagnoseExit(134, 'SIGABRT', '', sample, ext, ctx)
  expect(d.category).toBe('oom-heap')
  // Primary: child-reported heap (V8-internal)
  expect(d.adminMessage).toContain('heap used: 723.0MB')
  // Secondary: external RSS line
  expect(d.adminMessage).toMatch(/Last seen RSS \(external\):\s*815\.0MB/)
})

test('plugin-error with lastExt appends external line', () => {
  const d = diagnoseExit(1, null, 'EACCES: permission denied', null, ext, ctx)
  expect(d.category).toBe('plugin-error')
  expect(d.adminMessage).toMatch(/Last seen RSS \(external\):\s*815\.0MB/)
})

test('lastExt with null cpuRatio omits CPU usage line', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, { ...ext, cpuRatio: null }, ctx)
  expect(d.adminMessage).toMatch(/Last seen RSS \(external\):\s*815\.0MB/)
  expect(d.adminMessage).not.toMatch(/CPU usage/)
})
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx playwright test tests/features/worker-utils/exit-code.unit.spec.ts --reporter=list`
Expected: 5 new tests fail (and the existing tests fail to compile because the `diagnoseExit` signature hasn't been updated yet — that's fine).

- [ ] **Step 3: Update `exit-code.ts`**

In `worker/src/utils/exit-code.ts`:

Add import at the top:

```ts
import type { ExternalSample } from '../task/external-sampler.ts'
```

Add a render helper near the top (after `memLineFr`):

```ts
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
```

Update each `oom*Admin` / `oom*User` builder to splice in those lines. For `oomHostAdmin`:

```ts
const oomHostAdmin = (lastMem: MemorySample | null, lastExt: ExternalSample | null, ctx: DiagnoseContext): string => [
  'Task killed by the OS (SIGKILL, likely container OOM-killer).',
  memLine(lastMem, ctx.maxHeapMB),
  ...extLines(lastExt),
  'The container memory limit was probably exceeded.',
  'Mitigation: raise the container memory limit, or lower WORKER_CONCURRENCY.'
].join('\n')
```

Apply the same `lastExt` parameter + `...extLines(lastExt)` splice to `oomHostUser` (use `extLinesFr`), `oomHeapAdmin` (place after `memLine`), `oomHeapUser` (use `extLinesFr` after `memLineFr`).

For `plugin-error`, the current message comes from `buildErrorMessageFromStderr`. Append the external lines after it:

```ts
if (code === 1) {
  const base = buildErrorMessageFromStderr(stderr, 'child process exited with code 1')
  const adminMsg = [base, ...extLines(lastExt)].filter(Boolean).join('\n')
  const userMsg = [base, ...extLinesFr(lastExt)].filter(Boolean).join('\n')
  return {
    category: 'plugin-error',
    adminMessage: adminMsg,
    userMessage: userMsg
  }
}
```

For the `unknown` branch, append the same way:

```ts
return {
  category: 'unknown',
  adminMessage: [
    `Task ended unexpectedly (code=${code}, signal=${signal ?? 'null'}). ${buildErrorMessageFromStderr(stderr, '')}`.trim(),
    ...extLines(lastExt)
  ].join('\n'),
  userMessage: [unknownUser(code, signal, stderr), ...extLinesFr(lastExt)].join('\n')
}
```

Finally update the public signature:

```ts
export const diagnoseExit = (
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
  lastMem: MemorySample | null,
  lastExt: ExternalSample | null,
  ctx: DiagnoseContext
): ExitDiagnosis => {
  // ... rest unchanged except passing lastExt through to the helpers
}
```

- [ ] **Step 4: Run exit-code tests**

Run: `npx playwright test tests/features/worker-utils/exit-code.unit.spec.ts --reporter=list`
Expected: all tests (old + new) pass.

- [ ] **Step 5: Typecheck the whole project**

Run: `npm run check-types`
Expected: passes — Task 6's broken build is now fixed because `diagnoseExit` accepts the extra argument.

- [ ] **Step 6: Run all worker-utils tests**

Run: `npx playwright test tests/features/worker-utils/ --reporter=list`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add worker/src/utils/exit-code.ts tests/features/worker-utils/exit-code.unit.spec.ts
git commit -m "$(cat <<'EOF'
feat(worker): include external RSS/CPU% in exit diagnostics

diagnoseExit now accepts a lastExt parameter (the most recent
ExternalSample) and weaves "Last seen RSS (external)" plus optional
"CPU usage (external)" lines into oom-host, oom-heap, plugin-error,
and unknown diagnostics. French run-log text mirrors the English ops
message.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: e2e — CPU-saturated task still reports RSS externally

**Files:**
- Create: `tests/fixtures/processing-cpu-leak/index.js`
- Create: `tests/fixtures/processing-cpu-leak/package.json`
- Create: `tests/fixtures/processing-cpu-leak/processing-config-schema.json`
- Modify: `tests/features/processings/memory-oom.e2e.spec.ts`

The CPU-leak fixture busy-loops while allocating moderate memory, so the in-process df-mem sampler would go stale while the external sampler keeps ticking. The test asserts the per-slot RSS gauge moved during the run.

- [ ] **Step 1: Create fixture `package.json`**

Create `tests/fixtures/processing-cpu-leak/package.json`:

```json
{
  "name": "@data-fair-tests/processing-cpu-leak",
  "version": "1.0.0",
  "description": "Test plugin that busy-loops while allocating, to validate external sampling keeps reporting.",
  "main": "index.js",
  "type": "module",
  "files": ["index.js", "processing-config-schema.json"]
}
```

- [ ] **Step 2: Create fixture `processing-config-schema.json`**

Create `tests/fixtures/processing-cpu-leak/processing-config-schema.json`:

```json
{
  "type": "object",
  "additionalProperties": true,
  "properties": {}
}
```

- [ ] **Step 3: Create fixture `index.js`**

Create `tests/fixtures/processing-cpu-leak/index.js`:

```js
// Test fixture: busy-loop the event loop in 500ms bursts for ~25 seconds
// total, while growing moderately-sized arrays of native JS values. The
// goal is NOT to OOM (the run should complete normally) — it's to:
//   1. Keep the child's event loop saturated long enough that the
//      in-process df-mem sampler would go stale (timer ticks delayed).
//   2. Span at least 2× WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS (default
//      10s) so the external sampler fires its baseline tick AND at
//      least one running tick — meaning the CPU-ratio gauge will be
//      populated with a non-null value, which the e2e test asserts on.
export const run = async (context) => {
  const { log } = context
  const totalBursts = 50
  await log.step(`starting cpu-leak fixture (${totalBursts} bursts of CPU saturation + alloc)`)
  const sink = []
  for (let burst = 0; burst < totalBursts; burst++) {
    const t = Date.now()
    // Busy-loop ~500 ms — this is what makes setInterval-based timers
    // INSIDE the task miss their tick, while the parent (which lives
    // in a different process) keeps reading /proc on schedule.
    while (Date.now() - t < 500) {
      // tight loop, intentionally no yield
    }
    const chunk = new Array(100_000)
    for (let j = 0; j < chunk.length; j++) {
      chunk[j] = { burst, j, s: 'cpu-leak-' + burst + '-' + j }
    }
    sink.push(chunk)
    if (burst % 10 === 0) await log.step(`burst ${burst + 1}/${totalBursts}`)
    // Yield once between bursts so the worker can still deliver signals.
    await new Promise(resolve => setImmediate(resolve))
  }
  await log.info('cpu-leak fixture finished cleanly')
}
```

- [ ] **Step 4: Add the e2e test case**

Open `tests/features/processings/memory-oom.e2e.spec.ts`. Add an extractor helper near the top, after `extractOomHeapCount`:

```ts
const extractTaskRssBytes = (metrics: string, slot: number): number | null => {
  // df_processings_process_resident_memory_bytes{kind="task",slot="0"} 12345
  const re = new RegExp(
    `^df_processings_process_resident_memory_bytes\\{[^}]*kind="task"[^}]*slot="${slot}"[^}]*\\}\\s+(\\d+(?:\\.\\d+)?)`,
    'm'
  )
  const m = metrics.match(re)
  return m ? Number(m[1]) : null
}

const extractTaskCpuRatio = (metrics: string, slot: number): number | null => {
  const re = new RegExp(
    `^df_processings_process_cpu_usage_ratio\\{[^}]*kind="task"[^}]*slot="${slot}"[^}]*\\}\\s+(\\d+(?:\\.\\d+)?)`,
    'm'
  )
  const m = metrics.match(re)
  return m ? Number(m[1]) : null
}

const buildCpuLeakTarball = (): string => {
  const fixtureDir = path.resolve(import.meta.dirname, '../../fixtures/processing-cpu-leak')
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpu-leak-pack-'))
  execSync('npm pack --pack-destination ' + outDir, { cwd: fixtureDir, stdio: 'pipe' })
  const tarball = fs.readdirSync(outDir).find(f => f.endsWith('.tgz'))
  if (!tarball) throw new Error('npm pack did not produce a tarball')
  return path.join(outDir, tarball)
}
```

Then add the test case inside the existing `test.describe('memory pressure diagnostics', ...)` block:

```ts
test('CPU-saturated task still reports RSS via external sampler', async () => {
  test.skip(process.platform !== 'linux', 'external sampler is Linux-only')
  test.setTimeout(120_000)

  const superadmin = await axiosAuth('test_superadmin@test.com')

  // Snapshot the metrics for all 4 slots before triggering. We need a
  // "moved" assertion that's robust whichever slot picks up the run.
  const baselineMetrics = (await anonymousAx.get(metricsUrl)).data as string
  const baselineRss: Array<number | null> = [0, 1, 2, 3].map(s => extractTaskRssBytes(baselineMetrics, s))

  const tarballPath = buildCpuLeakTarball()
  const plugin = await publishFixturePlugin({
    name: '@data-fair-tests/processing-cpu-leak',
    version: '1.0.0',
    tarballPath
  })
  const processing = (await superadmin.post('/api/v1/processings', {
    title: 'CPU leak test',
    plugin: plugin.pluginId,
    owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' },
    active: true,
    config: {}
  })).data
  const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data
  const finalRun = await waitForRunStatus(triggered._id, 'finished', 90_000)
  expect(finalRun.status).toBe('finished')

  // The cpu-leak fixture runs ~25 s. With the default 10 s sample
  // interval the external sampler will fire its baseline tick AND at
  // least one running tick — so at least one slot's CPU ratio gauge
  // should be populated with a non-trivial value. We use a permissive
  // OR-assertion so the test isn't sensitive to which slot the run
  // picked or to small RSS oscillations during the run.
  const finalMetrics = (await anonymousAx.get(metricsUrl)).data as string
  let observedExternal = false
  let observationDetails = ''
  for (const slot of [0, 1, 2, 3]) {
    const rss = extractTaskRssBytes(finalMetrics, slot)
    const cpu = extractTaskCpuRatio(finalMetrics, slot)
    observationDetails += ` slot${slot}={rss:${rss},cpu:${cpu}}`
    if (cpu !== null && cpu > 0.1) {
      observedExternal = true
      break
    }
    if (rss !== null && rss > 50 * 1024 * 1024 && rss !== (baselineRss[slot] ?? null)) {
      // Plausible Node-process RSS AND not the stale pre-run value
      observedExternal = true
      break
    }
  }
  expect(observedExternal, `no slot showed external-sampler activity:${observationDetails}`).toBe(true)
})
```

- [ ] **Step 5: Run only the new e2e test**

Run: `npx playwright test tests/features/processings/memory-oom.e2e.spec.ts --reporter=list -g "CPU-saturated task"`
Expected: passes within ~30 s. If it flakes locally because of dev-worker scheduling: verify the run actually picked a slot by inspecting `dev/logs/dev-worker.log` for `external-sampler enabled` at boot.

- [ ] **Step 6: Run the full memory-oom e2e file**

Run: `npx playwright test tests/features/processings/memory-oom.e2e.spec.ts --reporter=list`
Expected: both tests pass (the existing oom-heap and the new cpu-saturated).

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures/processing-cpu-leak tests/features/processings/memory-oom.e2e.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cpu-saturated task still reports RSS externally

New fixture processing-cpu-leak busy-loops in 200ms bursts while
allocating moderate JS heap, then asserts the per-slot Prometheus
gauges (RSS, CPU ratio) reflect activity — proving the parent-side
sampler kept ticking through child event-loop saturation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Documentation — `memory-management.md`

**Files:**
- Modify: `docs/architecture/memory-management.md`

- [ ] **Step 1: Update the "Configuration" table**

Open `docs/architecture/memory-management.md`. Add a row to the Configuration table:

```markdown
| `WORKER_TASK_EXTERNAL_SAMPLER_ENABLED` | true | Parent-side /proc-based RSS/CPU sampler. Auto-disabled at boot when /proc is unavailable. |
```

- [ ] **Step 2: Add the "External sampler" subsection**

Insert a new `## External sampler` section immediately AFTER the existing `## Sampling cadence` section and BEFORE `## Metrics`:

```markdown
## External sampler

The in-process `df-mem` reporter described in [Sampling cadence](#sampling-cadence)
shares its event loop with the plugin. A CPU-bound plugin can starve the
sampler entirely — gauges go stale and the `lastMem` attached to an
`oom-host` diagnostic may be many seconds old at the moment of the kernel
kill.

To resist this, the parent worker also runs a `/proc`-based sampler per
slot. It is the **authoritative writer** for the per-slot RSS gauge
`df_processings_process_resident_memory_bytes{kind="task"}`, and it
writes a new CPU-ratio gauge
`df_processings_process_cpu_usage_ratio{kind="task"}` (1.0 = one full
core).

The in-process `df-mem` reporter keeps writing the V8-internal counters
(`heapTotal`, `heapUsed`, `external`, `arrayBuffers`) — those are not
visible through `/proc`. When the external sampler is **disabled**
(non-Linux dev environment or `WORKER_TASK_EXTERNAL_SAMPLER_ENABLED=false`),
the in-process reporter re-takes RSS authority so dev environments don't
lose RSS visibility entirely.

### Reader

`worker/src/utils/proc-stat.ts` reads:

- `/proc/<pid>/status` — extracts `VmRSS` (kB → bytes).
- `/proc/<pid>/stat` — extracts `utime` (field 14) and `stime` (field 15).
  The parser slices from the **last** `)` to handle process names that
  contain spaces, parens, or newlines.

CPU usage is computed as a delta between the previous snapshot and the
current one:

```
cpuSeconds  = ((Δutime + Δstime) / CLOCK_TICKS_PER_SEC)
wallSeconds = Δreadat_ms / 1000
ratio       = cpuSeconds / wallSeconds      // 1.0 = one core
```

`CLOCK_TICKS_PER_SEC` is detected once at worker boot via
`getconf CLK_TCK` with a fallback to `100`.

### Lifecycle

Per-slot `setInterval` is created in `worker/src/worker.ts::iter()`
right after `child.spawn()` and stopped in the `close` (and `error`)
handlers — before `setSlotState(slot, false)` so no tick fires against
an idle slot. The first sample is the baseline (RSS only, `cpuRatio: null`);
subsequent ticks emit a fresh CPU ratio.

### Failure modes

- **PID disappears between ticks** (`ENOENT` from `/proc/<pid>/…`):
  sampler stops silently. `child.on('close')` fires shortly after.
- **Other `/proc` read error**: warn once for that slot, stop the timer.
  Other slots keep going.
- **Baseline read returns `null`** (child died between spawn and the
  first tick — extremely rare): sampler returns a no-op handle. No
  gauges written, diagnostic falls back to in-process `lastMem`.

### Out of scope

- Subprocesses spawned by the plugin (e.g. a Python helper) are **not**
  walked — only the immediate Node child is sampled. The cgroup OOM-killer
  remains the safety net for runaway subprocesses.
- The external sampler is **observe-only**. There is no
  `WORKER_TASK_MAX_RSS_MB` and no new `oom-rss` exit category — the
  kernel/cgroup OOM-killer is still the only RSS-based enforcement path.
- macOS / Windows: no `/proc`, so the sampler logs a one-line skip notice
  at boot and stays disabled. The in-process `df-mem` reporter still
  drives RSS in those environments.
```

- [ ] **Step 3: Update the Metrics table**

Find the Metrics table (after the new External sampler subsection). Add a row for the CPU gauge:

```markdown
| `df_processings_process_cpu_usage_ratio` | gauge | `kind`, `slot` |
```

Right below the table, add a footnote (or extend an existing paragraph):

```markdown
For `kind="task"`, `df_processings_process_resident_memory_bytes` is
**parent-observed** (read from `/proc/<pid>` in the worker) when the
external sampler is active. It is child-reported otherwise. The other
three memory gauges (`heap_size_total`, `heap_size_used`,
`external_memory`) are always child-reported via the `df-mem:` stdout
protocol — they expose V8 internal state that is not visible from `/proc`.
```

- [ ] **Step 4: Verify markdown renders cleanly**

Run: `grep -n "## External sampler\|External sampler" docs/architecture/memory-management.md`
Expected: subsection appears between "Sampling cadence" and "Metrics".

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/memory-management.md
git commit -m "$(cat <<'EOF'
docs(memory): document external sampler and metric semantics shift

Adds an "External sampler" subsection covering the procfs reader, CPU
math, lifecycle, and failure modes. Updates the Metrics table to add
df_processings_process_cpu_usage_ratio and clarifies that the per-slot
RSS gauge is parent-observed when the external sampler is active.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Full verification + push

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 2: Typecheck**

Run: `npm run check-types`
Expected: passes.

- [ ] **Step 3: Unit tests**

Run: `npm run test-unit`
Expected: all worker-utils unit tests pass, including the new `proc-stat` and `external-sampler` suites.

- [ ] **Step 4: Spot-check the e2e suite**

Run only the memory-oom e2e file to keep the run time short:

Run: `npx playwright test tests/features/processings/memory-oom.e2e.spec.ts --reporter=list`
Expected: both tests pass.

- [ ] **Step 5: Verify dev worker boots cleanly**

Read `dev/logs/dev-worker.log` to confirm:
- `[external-sampler] enabled: per-slot RSS/CPU sampled from /proc` appears once.
- `[memory-budget]` startup line still appears.
- No warnings about `/proc` read failures.

If the dev environment is not running (`bash dev/status.sh` shows dev-worker down), DO NOT start it — the user manages dev processes. Just note in your summary that the dev log was not verifiable.

- [ ] **Step 6: Verify gauges visible**

If dev-worker is healthy: `curl -s http://localhost:${DEV_WORKER_OBSERVER_PORT:-9091}/metrics | grep df_processings_process_cpu_usage_ratio`
Expected: at least the gauge header appears, even if no run has yet populated values:

```
# HELP df_processings_process_cpu_usage_ratio Per-process CPU usage as a fraction of one core over the last sample window (1.0 = one full core)
# TYPE df_processings_process_cpu_usage_ratio gauge
```

- [ ] **Step 7: Push and open PR**

Stop here for the human to review and open the PR — do not push or open the PR autonomously unless explicitly asked.
