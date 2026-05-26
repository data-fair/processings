# Memory Pressure Diagnostics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit V8 heap budget per task child process, plus startup memory sanity reporting, exit-code categorisation, per-task memory sampling over stdout, and prom-client-named gauges labelled by task slot. Keep the existing child-process execution model.

**Architecture:** Five small focused units, each independently testable. Pure logic (exit-code classification, budget math, sample parsing) lives in `worker/src/utils/`. A per-task in-child reporter (`worker/src/task/memory-reporter.ts`) writes `df-mem:` JSON lines to stdout (always) and debug entries to mongo (when `processing.debug`). The parent worker (`worker/src/worker.ts`) gains stdout demux, slot tracking, and a richer close handler that uses the exit-code categoriser to produce English admin-facing log entries.

**Tech Stack:** TypeScript, Node `node:child_process`, Node `node:fs/promises`, prom-client, Playwright (test runner), pino-style logging via `Debug` and `console.warn`.

**Spec:** `docs/superpowers/specs/2026-05-26-perf-mem-management-design.md`

---

## File map

**Create:**
- `worker/src/utils/memory-budget.ts` — cgroup detection + budget math + report formatter
- `worker/src/utils/exit-code.ts` — pure function: `(code, signal, stderr, lastMem, ctx) → diagnosis`
- `worker/src/utils/mem-sample.ts` — pure helpers: `parseMemSampleLine`, `splitMemSampleLines`, `formatMem`
- `worker/src/task/memory-reporter.ts` — runs inside the child; emits stdout samples + debug log entries
- `tests/features/worker-utils/memory-budget.unit.spec.ts`
- `tests/features/worker-utils/exit-code.unit.spec.ts`
- `tests/features/worker-utils/mem-sample.unit.spec.ts`
- `tests/features/processings/memory-oom.e2e.spec.ts`
- `tests/fixtures/plugins/oom-leak/package.json`
- `tests/fixtures/plugins/oom-leak/index.js`

**Modify:**
- `worker/config/default.mjs` — add `worker.task` block
- `worker/config/custom-environment-variables.mjs` — add env bindings
- `worker/config/type/schema.json` — schema for `worker.task`
- `worker/src/worker.ts` — spawn argv, stdout demux, slot tracking, close-handler refactor, startup budget report
- `worker/src/task/task.ts` — initialise `memory-reporter`
- `worker/src/utils/metrics.ts` — register new gauges + counter
- `worker/src/utils/runs.ts` — pass `errorLogType='error'` only when diagnosis says so (no signature change)

---

## Conventions

- **Commit style:** `feat(worker):`, `feat(worker-config):`, `test:`, `docs:` — match recent commits like `feat!: v6 registry integration` and `refactor(ui): migrate to Vuetify 4`.
- **Language:** Admin-facing diagnostic messages in **English**; existing end-user log strings (e.g. `task.ts:85`) stay French. (Project preference: see memory `feedback_log_languages.md`.)
- **Tests:** Use `@playwright/test` (`test`, `expect`), follow `tests/features/worker-utils/runs-operations.unit.spec.ts` structure.
- **Imports:** TS path aliases `#config`, `#mongo` are valid in worker code; tests import via relative paths (`../../../worker/src/utils/...`).
- **Run tests:** `npx playwright test path/to/file.spec.ts` (the e2e test runs against the real dev environment per `AGENTS.md`).

---

## Task 1: Config schema — add `worker.task` block

**Files:**
- Modify: `worker/config/default.mjs`
- Modify: `worker/config/custom-environment-variables.mjs`
- Modify: `worker/config/type/schema.json`

- [ ] **Step 1: Add defaults to `worker/config/default.mjs`**

Replace the `worker` block (lines 48-60) with:

```js
  worker: {
    // base interval for polling the database for new resources to work on
    interval: 2000,
    // additional interval when the worker is inactive (no resource found recently)
    // prevent polling too frequently during slow activity periods
    inactiveInterval: 10000,
    // delay of inactivity before we consider the worker as sleeping
    inactivityDelay: 60000,
    // interval of the secondary loop that manages killing tasks
    killInterval: 20000,
    concurrency: 4,
    gracePeriod: 20000,
    task: {
      // max V8 old-generation heap for each task child process, in MB.
      // Passed as --max-old-space-size to the spawned child.
      maxHeapMB: 768,
      // interval at which the child task samples process.memoryUsage()
      // and writes both a df-mem: stdout line (parent updates gauges) and,
      // when processing.debug is true, a debug entry in run.log.
      // Set to 0 to disable periodic sampling (exit-time sample still emitted).
      memorySampleIntervalMs: 10000,
      // Startup sanity check warns when projected concurrency*maxHeapMB usage
      // leaves less than (100 - warnPct)% headroom against effective memory.
      memoryHeadroomWarnPct: 70
    }
  },
```

- [ ] **Step 2: Add env bindings to `worker/config/custom-environment-variables.mjs`**

Replace the `worker` block (lines 36-43) with:

```js
  worker: {
    interval: 'WORKER_INTERVAL',
    inactiveInterval: 'WORKER_INACTIVE_INTERVAL',
    inactivityDelay: 'WORKER_INACTIVITY_DELAY',
    killInterval: 'WORKER_KILL_INTERVAL',
    concurrency: 'WORKER_CONCURRENCY',
    gracePeriod: 'WORKER_GRACE_PERIOD',
    task: {
      maxHeapMB: 'WORKER_TASK_MAX_HEAP_MB',
      memorySampleIntervalMs: 'WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS',
      memoryHeadroomWarnPct: 'WORKER_TASK_MEMORY_HEADROOM_WARN_PCT'
    }
  }
```

- [ ] **Step 3: Extend the JSON schema in `worker/config/type/schema.json`**

In the `worker` properties block (around lines 132-162), update `required` and add `task` to `properties`. Replace the full `"worker"` schema entry with:

```json
    "worker": {
      "type": "object",
      "required": [
        "interval",
        "inactiveInterval",
        "inactivityDelay",
        "killInterval",
        "concurrency",
        "gracePeriod",
        "task"
      ],
      "properties": {
        "interval": { "type": "number" },
        "inactiveInterval": { "type": "number" },
        "inactivityDelay": { "type": "number" },
        "killInterval": { "type": "number" },
        "concurrency": { "type": "number" },
        "gracePeriod": { "type": "number" },
        "task": {
          "type": "object",
          "required": ["maxHeapMB", "memorySampleIntervalMs", "memoryHeadroomWarnPct"],
          "properties": {
            "maxHeapMB": { "type": "number", "minimum": 64 },
            "memorySampleIntervalMs": { "type": "number", "minimum": 0 },
            "memoryHeadroomWarnPct": { "type": "number", "minimum": 0, "maximum": 100 }
          }
        }
      }
    },
```

- [ ] **Step 4: Regenerate generated types**

Run: `npm run build-types`
Expected: exits 0; `worker/config/type/.type/index.d.ts` updated to reflect the new `task` block.

- [ ] **Step 5: Verify type-check and lint pass**

Run: `npm run check-types && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add worker/config/default.mjs worker/config/custom-environment-variables.mjs worker/config/type/schema.json worker/config/type/.type/index.d.ts
git commit -m "feat(worker-config): add worker.task heap/sampling config"
```

---

## Task 2: `mem-sample.ts` — pure parser + formatter

**Files:**
- Create: `worker/src/utils/mem-sample.ts`
- Test: `tests/features/worker-utils/mem-sample.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/features/worker-utils/mem-sample.unit.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import {
  parseMemSampleLine,
  splitMemSampleLines,
  formatMem,
  type MemorySample
} from '../../../worker/src/utils/mem-sample.ts'

test.describe('parseMemSampleLine', () => {
  test('parses a well-formed df-mem line', () => {
    const line = 'df-mem:{"t":1700000000000,"phase":"running","rss":12345,"heapTotal":2000,"heapUsed":1000,"external":500,"arrayBuffers":100}'
    const out = parseMemSampleLine(line)
    expect(out).toEqual({
      t: 1700000000000,
      phase: 'running',
      rss: 12345,
      heapTotal: 2000,
      heapUsed: 1000,
      external: 500,
      arrayBuffers: 100
    })
  })

  test('returns null for line without df-mem prefix', () => {
    expect(parseMemSampleLine('hello world')).toBeNull()
  })

  test('returns null for malformed JSON after prefix', () => {
    expect(parseMemSampleLine('df-mem:{not json')).toBeNull()
  })

  test('returns null when required fields are missing', () => {
    expect(parseMemSampleLine('df-mem:{"t":1}')).toBeNull()
  })

  test('accepts startup and exit phases', () => {
    const startup = parseMemSampleLine('df-mem:{"t":1,"phase":"startup","rss":1,"heapTotal":1,"heapUsed":1,"external":1,"arrayBuffers":1}')
    const exit = parseMemSampleLine('df-mem:{"t":1,"phase":"exit","rss":1,"heapTotal":1,"heapUsed":1,"external":1,"arrayBuffers":1}')
    expect(startup?.phase).toBe('startup')
    expect(exit?.phase).toBe('exit')
  })

  test('returns null for unknown phase', () => {
    expect(parseMemSampleLine('df-mem:{"t":1,"phase":"weird","rss":1,"heapTotal":1,"heapUsed":1,"external":1,"arrayBuffers":1}')).toBeNull()
  })
})

test.describe('splitMemSampleLines', () => {
  test('separates df-mem lines from other lines', () => {
    const out = splitMemSampleLines(
      'hello\ndf-mem:{"t":1,"phase":"running","rss":1,"heapTotal":1,"heapUsed":1,"external":1,"arrayBuffers":1}\nworld\n',
      ''
    )
    expect(out.samples).toHaveLength(1)
    expect(out.other).toEqual(['hello', 'world'])
    expect(out.residual).toBe('')
  })

  test('returns partial line as residual', () => {
    const out = splitMemSampleLines('hello\npartial', '')
    expect(out.other).toEqual(['hello'])
    expect(out.residual).toBe('partial')
    expect(out.samples).toHaveLength(0)
  })

  test('joins previous residual with new chunk', () => {
    const first = splitMemSampleLines('df-mem:{"t":1,"phase":"running","rss":1,"heap', '')
    expect(first.residual).not.toBe('')
    const second = splitMemSampleLines('Total":1,"heapUsed":1,"external":1,"arrayBuffers":1}\n', first.residual)
    expect(second.samples).toHaveLength(1)
  })

  test('drops malformed df-mem lines silently', () => {
    const out = splitMemSampleLines('df-mem:bad json\nok\n', '')
    expect(out.samples).toHaveLength(0)
    expect(out.other).toEqual(['ok'])
  })
})

test.describe('formatMem', () => {
  test('renders heap/rss in MB with one decimal', () => {
    const sample: MemorySample = {
      t: 0, phase: 'running',
      rss: 100 * 1024 * 1024,
      heapTotal: 50 * 1024 * 1024,
      heapUsed: 25 * 1024 * 1024,
      external: 5 * 1024 * 1024,
      arrayBuffers: 1 * 1024 * 1024
    }
    expect(formatMem(sample)).toBe('rss=100.0MB heapTotal=50.0MB heapUsed=25.0MB external=5.0MB arrayBuffers=1.0MB')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/features/worker-utils/mem-sample.unit.spec.ts --project unit`
Expected: FAIL with module-resolution error (file not yet created).

- [ ] **Step 3: Create `worker/src/utils/mem-sample.ts`**

```ts
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

const toMB = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1) + 'MB'

export const formatMem = (s: MemorySample): string =>
  `rss=${toMB(s.rss)} heapTotal=${toMB(s.heapTotal)} heapUsed=${toMB(s.heapUsed)} external=${toMB(s.external)} arrayBuffers=${toMB(s.arrayBuffers)}`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/features/worker-utils/mem-sample.unit.spec.ts --project unit`
Expected: PASS, all cases.

- [ ] **Step 5: Type-check and lint**

Run: `npm run check-types && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/utils/mem-sample.ts tests/features/worker-utils/mem-sample.unit.spec.ts
git commit -m "feat(worker): add mem-sample parser for df-mem stdout protocol"
```

---

## Task 3: `exit-code.ts` — diagnose child exits

**Files:**
- Create: `worker/src/utils/exit-code.ts`
- Test: `tests/features/worker-utils/exit-code.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/features/worker-utils/exit-code.unit.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { diagnoseExit } from '../../../worker/src/utils/exit-code.ts'
import type { MemorySample } from '../../../worker/src/utils/mem-sample.ts'

const ctx = { maxHeapMB: 768, concurrency: 4, runningTasks: 3 }

const sample: MemorySample = {
  t: 0, phase: 'exit',
  rss: 812 * 1024 * 1024,
  heapTotal: 740 * 1024 * 1024,
  heapUsed: 723 * 1024 * 1024,
  external: 5 * 1024 * 1024,
  arrayBuffers: 1 * 1024 * 1024
}

test('code 0 -> success, no log entry', () => {
  const d = diagnoseExit(0, null, '', null, ctx)
  expect(d.category).toBe('success')
})

test('SIGTERM -> sigterm (silent)', () => {
  const d = diagnoseExit(143, 'SIGTERM', '', sample, ctx)
  expect(d.category).toBe('sigterm')
})

test('code 143 alone is sigterm', () => {
  const d = diagnoseExit(143, null, '', sample, ctx)
  expect(d.category).toBe('sigterm')
})

test('SIGKILL -> oom-host', () => {
  const d = diagnoseExit(null, 'SIGKILL', '', sample, ctx)
  expect(d.category).toBe('oom-host')
  expect(d.logType).toBe('error')
  expect(d.adminMessage).toContain('Task killed by the OS')
  expect(d.adminMessage).toContain('SIGKILL')
  expect(d.adminMessage).toContain('heap used: 723.0MB')
  expect(d.adminMessage).toContain('RSS: 812.0MB')
})

test('code 137 -> oom-host (even without signal)', () => {
  const d = diagnoseExit(137, null, '', sample, ctx)
  expect(d.category).toBe('oom-host')
})

test('code 134 -> oom-heap with mention of max heap config', () => {
  const d = diagnoseExit(134, null, 'FATAL ERROR: JavaScript heap out of memory', sample, ctx)
  expect(d.category).toBe('oom-heap')
  expect(d.logType).toBe('error')
  expect(d.adminMessage).toContain('exit code 134')
  expect(d.adminMessage).toContain('WORKER_TASK_MAX_HEAP_MB=768')
  expect(d.adminMessage).toContain('Concurrent tasks at exit: 3 / concurrency 4')
})

test('code 134 with empty stderr still oom-heap', () => {
  const d = diagnoseExit(134, null, '', sample, ctx)
  expect(d.category).toBe('oom-heap')
})

test('SIGABRT -> oom-heap', () => {
  const d = diagnoseExit(null, 'SIGABRT', '', sample, ctx)
  expect(d.category).toBe('oom-heap')
})

test('null lastMem produces "no memory sample was reported before exit"', () => {
  const d = diagnoseExit(134, null, '', null, ctx)
  expect(d.adminMessage).toContain('no memory sample was reported before exit')
})

test('code 1 -> plugin-error using stderr', () => {
  const d = diagnoseExit(1, null, 'TypeError: foo is not a function', null, ctx)
  expect(d.category).toBe('plugin-error')
  expect(d.logType).toBe('error')
  expect(d.adminMessage).toContain('TypeError: foo')
})

test('unknown code 99 -> unknown', () => {
  const d = diagnoseExit(99, null, 'weird', null, ctx)
  expect(d.category).toBe('unknown')
  expect(d.logType).toBe('error')
  expect(d.adminMessage).toContain('code=99')
})

test('null code, null signal -> unknown', () => {
  const d = diagnoseExit(null, null, '', null, ctx)
  expect(d.category).toBe('unknown')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/features/worker-utils/exit-code.unit.spec.ts --project unit`
Expected: FAIL with module-resolution error.

- [ ] **Step 3: Create `worker/src/utils/exit-code.ts`**

```ts
import { buildErrorMessageFromStderr } from './worker-operations.ts'
import { formatMem, type MemorySample } from './mem-sample.ts'

export type ExitCategory =
  | 'success' | 'sigterm' | 'oom-heap' | 'oom-host'
  | 'plugin-error' | 'unknown'

export type ExitDiagnosis = {
  category: ExitCategory
  adminMessage: string
  logType: 'info' | 'debug' | 'error'
}

export type DiagnoseContext = {
  maxHeapMB: number
  concurrency: number
  runningTasks: number
}

const memLine = (lastMem: MemorySample | null, maxHeapMB: number): string => {
  if (!lastMem) return 'no memory sample was reported before exit'
  const toMB = (b: number) => (b / (1024 * 1024)).toFixed(1) + 'MB'
  return `Last memory sample — heap used: ${toMB(lastMem.heapUsed)} / ${maxHeapMB}MB; RSS: ${toMB(lastMem.rss)}.`
}

const oomHeapMessage = (lastMem: MemorySample | null, ctx: DiagnoseContext): string => [
  'Task exceeded the JavaScript heap limit (heap OOM, exit code 134).',
  memLine(lastMem, ctx.maxHeapMB),
  `Concurrent tasks at exit: ${ctx.runningTasks} / concurrency ${ctx.concurrency}.`,
  `Configuration: WORKER_TASK_MAX_HEAP_MB=${ctx.maxHeapMB}.`,
  'Mitigation: raise WORKER_TASK_MAX_HEAP_MB, lower WORKER_CONCURRENCY, or inspect the plugin for a memory leak.'
].join('\n')

const oomHostMessage = (lastMem: MemorySample | null, ctx: DiagnoseContext): string => [
  'Task killed by the OS (SIGKILL, likely container OOM-killer).',
  memLine(lastMem, ctx.maxHeapMB),
  'The container memory limit was probably exceeded.',
  'Mitigation: raise the container memory limit, or lower WORKER_CONCURRENCY.'
].join('\n')

export const diagnoseExit = (
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
  lastMem: MemorySample | null,
  ctx: DiagnoseContext
): ExitDiagnosis => {
  if (code === 0 && signal === null) {
    return { category: 'success', adminMessage: '', logType: 'info' }
  }
  if (signal === 'SIGTERM' || code === 143) {
    return { category: 'sigterm', adminMessage: '', logType: 'info' }
  }
  if (signal === 'SIGKILL' || code === 137) {
    return {
      category: 'oom-host',
      adminMessage: oomHostMessage(lastMem, ctx),
      logType: 'error'
    }
  }
  if (code === 134 || signal === 'SIGABRT') {
    return {
      category: 'oom-heap',
      adminMessage: oomHeapMessage(lastMem, ctx),
      logType: 'error'
    }
  }
  if (code === 1) {
    return {
      category: 'plugin-error',
      adminMessage: buildErrorMessageFromStderr(stderr, `child process exited with code 1`),
      logType: 'error'
    }
  }
  return {
    category: 'unknown',
    adminMessage: `Task ended unexpectedly (code=${code}, signal=${signal ?? 'null'}). ${buildErrorMessageFromStderr(stderr, '')}`.trim(),
    logType: 'error'
  }
}

// Re-export for callers that already imported from this module historically
export { formatMem }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/features/worker-utils/exit-code.unit.spec.ts --project unit`
Expected: PASS.

- [ ] **Step 5: Type-check and lint**

Run: `npm run check-types && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/utils/exit-code.ts tests/features/worker-utils/exit-code.unit.spec.ts
git commit -m "feat(worker): add exit-code diagnosis for child OOM cases"
```

---

## Task 4: `memory-budget.ts` — cgroup detection + budget report

**Files:**
- Create: `worker/src/utils/memory-budget.ts`
- Test: `tests/features/worker-utils/memory-budget.unit.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/features/worker-utils/memory-budget.unit.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  computeBudget,
  detectContainerLimitMB,
  formatReport,
  type MemoryBudgetInput
} from '../../../worker/src/utils/memory-budget.ts'

const baseInput: MemoryBudgetInput = {
  hostTotalMB: 8192,
  containerLimitMB: 2048,
  workerProcessRssMB: 72,
  concurrency: 4,
  taskMaxHeapMB: 768,
  warnThresholdPct: 70
}

test.describe('computeBudget', () => {
  test('overbudget when projected exceeds effective', () => {
    const r = computeBudget(baseInput)
    // effective = min(2048, 8192) = 2048
    // projected = 4 * 768 = 3072
    // headroom = 2048 - 72 - 3072 = -1096
    expect(r.effectiveLimitMB).toBe(2048)
    expect(r.projectedTaskHeapMB).toBe(3072)
    expect(r.status).toBe('overbudget')
    expect(r.headroomPct).toBeLessThan(0)
  })

  test('ok when projected fits comfortably', () => {
    const r = computeBudget({ ...baseInput, containerLimitMB: 8192, taskMaxHeapMB: 256 })
    // projected = 4 * 256 = 1024 ; effective = 8192
    // headroomPct = (8192 - 72 - 1024) / 8192 ≈ 86.7%
    expect(r.status).toBe('ok')
    expect(r.headroomPct).toBeGreaterThan(70)
  })

  test('tight when headroom falls below threshold', () => {
    // projected just below effective
    const r = computeBudget({ ...baseInput, containerLimitMB: 4096, taskMaxHeapMB: 768 })
    // projected = 3072 ; headroom = 4096 - 72 - 3072 = 952 -> 23%
    expect(r.status).toBe('tight')
  })

  test('uses host total when containerLimitMB is null', () => {
    const r = computeBudget({ ...baseInput, containerLimitMB: null })
    expect(r.effectiveLimitMB).toBe(baseInput.hostTotalMB)
  })
})

test.describe('detectContainerLimitMB', () => {
  test('returns null when file does not exist', () => {
    expect(detectContainerLimitMB('/tmp/definitely-not-a-real-cgroup-path-xyz')).toBeNull()
  })

  test('returns null for "max"', () => {
    const tmp = path.join(os.tmpdir(), `memmax-${process.pid}-${Date.now()}`)
    fs.writeFileSync(tmp, 'max\n')
    try {
      expect(detectContainerLimitMB(tmp)).toBeNull()
    } finally { fs.unlinkSync(tmp) }
  })

  test('parses bytes into MB (rounded)', () => {
    const tmp = path.join(os.tmpdir(), `memmax-${process.pid}-${Date.now()}-b`)
    fs.writeFileSync(tmp, `${2 * 1024 * 1024 * 1024}\n`) // 2 GiB
    try {
      expect(detectContainerLimitMB(tmp)).toBe(2048)
    } finally { fs.unlinkSync(tmp) }
  })

  test('returns null on garbage content', () => {
    const tmp = path.join(os.tmpdir(), `memmax-${process.pid}-${Date.now()}-g`)
    fs.writeFileSync(tmp, 'banana\n')
    try {
      expect(detectContainerLimitMB(tmp)).toBeNull()
    } finally { fs.unlinkSync(tmp) }
  })
})

test.describe('formatReport', () => {
  test('produces a multiline report containing key fields', () => {
    const r = computeBudget(baseInput)
    const text = formatReport(r)
    expect(text).toContain('[memory-budget]')
    expect(text).toContain('host=8192MB')
    expect(text).toContain('container=2048MB')
    expect(text).toContain('concurrency=4')
    expect(text).toContain('task-max-heap=768MB')
    expect(text).toContain('status=OVERBUDGET')
  })

  test('shows container=unknown when limit is null', () => {
    const r = computeBudget({ ...baseInput, containerLimitMB: null })
    const text = formatReport(r)
    expect(text).toContain('container=unknown')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/features/worker-utils/memory-budget.unit.spec.ts --project unit`
Expected: FAIL with module-resolution error.

- [ ] **Step 3: Create `worker/src/utils/memory-budget.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/features/worker-utils/memory-budget.unit.spec.ts --project unit`
Expected: PASS, all cases.

- [ ] **Step 5: Type-check and lint**

Run: `npm run check-types && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/utils/memory-budget.ts tests/features/worker-utils/memory-budget.unit.spec.ts
git commit -m "feat(worker): add memory-budget cgroup detection and report"
```

---

## Task 5: `metrics.ts` — register memory gauges and exit counter

**Files:**
- Modify: `worker/src/utils/metrics.ts`

- [ ] **Step 1: Replace `worker/src/utils/metrics.ts` with the extended version**

```ts
import { Histogram, Gauge, Counter } from 'prom-client'
import { servicePromRegistry } from '@data-fair/lib-node/observer.js'
import mongo from '#mongo'
import type { MemorySample } from './mem-sample.ts'
import type { ExitCategory } from './exit-code.ts'

const runsMetrics = new Histogram({
  name: 'df_processings_runs',
  help: 'Number and duration in seconds of processing runs',
  buckets: [0.1, 1, 10, 60, 600],
  labelNames: ['status', 'owner']
})

// Process-level memory gauges, named to match prom-client defaults so a
// standard Node.js Grafana dashboard recognises them. We don't call
// collectDefaultMetrics() because that would re-register these names
// without our labels.
const rssGauge = new Gauge({
  name: 'process_resident_memory_bytes',
  help: 'Resident memory size in bytes',
  labelNames: ['kind', 'slot'],
  registers: [servicePromRegistry]
})

const heapTotalGauge = new Gauge({
  name: 'nodejs_heap_size_total_bytes',
  help: 'Process heap size from Node.js in bytes',
  labelNames: ['kind', 'slot'],
  registers: [servicePromRegistry]
})

const heapUsedGauge = new Gauge({
  name: 'nodejs_heap_size_used_bytes',
  help: 'Process heap size used from Node.js in bytes',
  labelNames: ['kind', 'slot'],
  registers: [servicePromRegistry]
})

const externalGauge = new Gauge({
  name: 'nodejs_external_memory_bytes',
  help: "Node.js external memory size in bytes",
  labelNames: ['kind', 'slot'],
  registers: [servicePromRegistry]
})

const slotStateGauge = new Gauge({
  name: 'df_processings_task_slot_state',
  help: 'Task slot state: 0 idle, 1 running',
  labelNames: ['slot'],
  registers: [servicePromRegistry]
})

const exitedCounter = new Counter({
  name: 'df_processings_runs_exited_total',
  help: 'Task run exits by diagnostic category',
  labelNames: ['category'],
  registers: [servicePromRegistry]
})

export const updateTaskMemoryGauges = (slot: number, sample: MemorySample): void => {
  const labels = { kind: 'task', slot: String(slot) }
  rssGauge.set(labels, sample.rss)
  heapTotalGauge.set(labels, sample.heapTotal)
  heapUsedGauge.set(labels, sample.heapUsed)
  externalGauge.set(labels, sample.external)
}

export const updateWorkerMemoryGauges = (): void => {
  const m = process.memoryUsage()
  const labels = { kind: 'worker', slot: '' }
  rssGauge.set(labels, m.rss)
  heapTotalGauge.set(labels, m.heapTotal)
  heapUsedGauge.set(labels, m.heapUsed)
  externalGauge.set(labels, m.external)
}

export const setSlotState = (slot: number, running: boolean): void => {
  slotStateGauge.set({ slot: String(slot) }, running ? 1 : 0)
}

export const recordExit = (category: ExitCategory): void => {
  exitedCounter.inc({ category })
}

const initMetrics = async (): Promise<void> => {
  // eslint-disable-next-line no-new
  new Gauge({
    name: 'df_processings_processings_total',
    help: 'Total number of processings',
    registers: [servicePromRegistry],
    async collect () {
      this.set(await mongo.processings.estimatedDocumentCount())
    }
  })
}

export { initMetrics, runsMetrics }
```

- [ ] **Step 2: Type-check**

Run: `npm run check-types`
Expected: exits 0.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Sanity-check that metric registration doesn't throw**

Run: `node --disable-warning=ExperimentalWarning -e "import('./worker/src/utils/metrics.ts').then(m => console.log('ok', Object.keys(m)))"`
Expected: `ok [ ... 'updateTaskMemoryGauges', 'updateWorkerMemoryGauges', 'setSlotState', 'recordExit', 'initMetrics', 'runsMetrics' ]` (some import side effects warnings may appear and can be ignored as long as the import resolves).

If the command fails because of missing #config or #mongo imports during a bare run, skip step 4 — type-check and the e2e in Task 9 cover the runtime path.

- [ ] **Step 5: Commit**

```bash
git add worker/src/utils/metrics.ts
git commit -m "feat(worker): register memory gauges and exit-category counter"
```

---

## Task 6: `memory-reporter.ts` — in-child sampler

**Files:**
- Create: `worker/src/task/memory-reporter.ts`
- Modify: `worker/src/task/task.ts`

- [ ] **Step 1: Create `worker/src/task/memory-reporter.ts`**

```ts
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
        void debug({
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
        })
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
```

- [ ] **Step 2: Wire the reporter into `worker/src/task/task.ts`**

In `worker/src/task/task.ts`, after the `log` LogFunctions are prepared (right after `log.warn = log.warning` line), insert the reporter init. Find this block (around `task.ts:81-87`):

```ts
  const log = prepareLog(processing, run)
  // @ts-expect-error -> warn is deprecated
  log.warn = log.warning // for compatibility with old plugins
  if (run.status === 'running') {
    await log.step('Reprise après interruption.')
  }
  await running(run)
  console.log('<running>')
```

Replace with:

```ts
  const log = prepareLog(processing, run)
  // @ts-expect-error -> warn is deprecated
  log.warn = log.warning // for compatibility with old plugins
  // Start memory sampler: emits df-mem: lines on stdout for parent metrics,
  // and (when processing.debug) appends debug entries to run.log.
  const { startMemoryReporter } = await import('./memory-reporter.ts')
  startMemoryReporter(processing, log.debug as unknown as Parameters<typeof startMemoryReporter>[1], config.worker.task.memorySampleIntervalMs)
  if (run.status === 'running') {
    await log.step('Reprise après interruption.')
  }
  await running(run)
  console.log('<running>')
```

Note: `log.debug` already gates on `processing.debug` internally — it's a no-op when debug is off. We pass it through; the reporter also checks `processing.debug` before invoking it (double-gate is intentional so we skip building the formatted string when debug is off).

- [ ] **Step 3: Type-check**

Run: `npm run check-types`
Expected: exits 0. If TS complains about the `import` typing, replace the dynamic import with a static import at the top of `task.ts`:

```ts
import { startMemoryReporter } from './memory-reporter.ts'
```

…and remove the dynamic-import line.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add worker/src/task/memory-reporter.ts worker/src/task/task.ts
git commit -m "feat(worker): in-child memory reporter (df-mem stdout + debug log)"
```

---

## Task 7: Refactor `worker.ts` — spawn flag, stdout demux, slot tracking, close handler

**Files:**
- Modify: `worker/src/worker.ts`

This task is intentionally larger because the changes are mutually dependent. Do them in order.

- [ ] **Step 1: Add imports at the top of `worker/src/worker.ts`**

Right after the existing imports (line 21), add:

```ts
import { splitMemSampleLines, type MemorySample } from './utils/mem-sample.ts'
import { diagnoseExit, type ExitDiagnosis } from './utils/exit-code.ts'
import { computeBudget, detectContainerLimitMB, formatReport } from './utils/memory-budget.ts'
import { updateTaskMemoryGauges, updateWorkerMemoryGauges, setSlotState, recordExit } from './utils/metrics.ts'
import os from 'node:os'
```

- [ ] **Step 2: Replace the spawn argv (line 212) to include `--max-old-space-size`**

Find (around line 212):

```ts
    const child = spawn('node', ['--disable-warning=ExperimentalWarning', './src/task/index.ts', run._id, processing._id], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
```

Replace with:

```ts
    const child = spawn('node', [
      `--max-old-space-size=${config.worker.task.maxHeapMB}`,
      '--disable-warning=ExperimentalWarning',
      './src/task/index.ts', run._id, processing._id
    ], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
```

- [ ] **Step 3: Replace the stdout handler with the sample demux**

Find (around lines 216-221):

```ts
    child.stdout?.on('data', data => {
      process.stdout.write(`[spawned task stdout] ${run.processing._id} / ${run._id}` + data)
      if (data.includes('<running>')) {
        // @test:spy("isRunning")
      }
    })
```

Replace with:

```ts
    let stdoutResidual = ''
    let lastMem: MemorySample | null = null
    child.stdout?.on('data', data => {
      const text = data.toString('utf8')
      const out = splitMemSampleLines(text, stdoutResidual)
      stdoutResidual = out.residual
      for (const sample of out.samples) {
        lastMem = sample
        updateTaskMemoryGauges(freeSlot, sample)
      }
      // Echo non-sample lines for ops visibility (preserving prior behaviour)
      for (const line of out.other) {
        process.stdout.write(`[spawned task stdout] ${run.processing._id} / ${run._id} ${line}\n`)
        if (line.includes('<running>')) {
          // @test:spy("isRunning")
        }
      }
    })
```

- [ ] **Step 4: Replace the close handler to capture both code and signal**

Find (around lines 232-242):

```ts
    pids[run._id] = child.pid || -1
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve()
        else {
          const err: any = new Error(`child process exited with code ${code}`)
          err.code = code
          reject(err)
        }
      })
      child.on('error', reject)
    })
    await finish(run)
```

Replace with:

```ts
    pids[run._id] = child.pid || -1
    setSlotState(freeSlot, true)
    const exitInfo: { code: number | null, signal: NodeJS.Signals | null } = { code: null, signal: null }
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code, signal) => {
        exitInfo.code = code
        exitInfo.signal = signal
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
    await finish(run)
```

- [ ] **Step 5: Replace the catch block to use the diagnosis**

Find (around lines 244-261):

```ts
  } catch (err: any) {
    // Build back the original error message from the stderr of the child process
    const errorMessage = buildErrorMessageFromStderr(stderr, err.message)

    if (run) {
      // case of interruption by a SIGTERM
      if (err.code === 143) {
        run.status = 'killed'
        await finish(run)
        // @test:spy("isKilled")
      } else {
        console.warn(`failure ${processing?.title ?? run.processing.title} > ${run._id}`, errorMessage)
        await finish(run, errorMessage)
        // @test:spy("isFailure")
      }
    } else {
      internalError('worker', err)
    }
  } finally {
```

Replace with:

```ts
  } catch (err: any) {
    if (run) {
      const runningTasks = promisePool.filter(p => p !== null).length
      const diag: ExitDiagnosis = diagnoseExit(
        err.code ?? null,
        (err.signal ?? null) as NodeJS.Signals | null,
        stderr,
        lastMem,
        {
          maxHeapMB: config.worker.task.maxHeapMB,
          concurrency: config.worker.concurrency,
          runningTasks
        }
      )
      recordExit(diag.category)
      if (diag.category === 'sigterm') {
        run.status = 'killed'
        await finish(run)
        // @test:spy("isKilled")
      } else {
        console.warn(`failure ${processing?.title ?? run.processing.title} > ${run._id} [${diag.category}]`, diag.adminMessage || err.message)
        await finish(run, diag.adminMessage || buildErrorMessageFromStderr(stderr, err.message), diag.logType)
        // @test:spy("isFailure")
      }
    } else {
      internalError('worker', err)
    }
  } finally {
```

The `lastMem` and `stdoutResidual` references inside the catch block require that those `let` bindings be declared in the outer `try` scope. They are: step 3 places them at the top of the spawn block, which is inside the `try`. Confirm by reading lines around the catch and adjust the indentation/scope if needed.

If TS complains that `lastMem` is unused (because the catch uses it indirectly), it isn't — the diagnosis call reads it. If it complains about scope, move both `let stdoutResidual = ''` and `let lastMem: MemorySample | null = null` to right after the `let stderr = ''` line in `iter()` (around line 188).

- [ ] **Step 6: Hoist `lastMem` and `stdoutResidual` to function scope**

Find (around line 188):

```ts
async function iter (run: Run) {
  let stderr = ''
  const processing = await mongo.processings.findOne({ _id: run.processing._id })
```

Replace with:

```ts
async function iter (run: Run, freeSlot: number) {
  let stderr = ''
  let stdoutResidual = ''
  let lastMem: MemorySample | null = null
  const processing = await mongo.processings.findOne({ _id: run.processing._id })
```

Then in step 3 above, remove the inner `let stdoutResidual = ''` and `let lastMem = null` declarations (they're now hoisted).

Update the caller (around lines 116-117):

```ts
      const iterPromise = iter(run)
      promisePool[freeSlot] = iterPromise
```

Replace with:

```ts
      const iterPromise = iter(run, freeSlot)
      promisePool[freeSlot] = iterPromise
```

- [ ] **Step 7: Add startup memory budget report to `start()`**

Find (in `start()`, around line 56-58):

```ts
  // initialize empty promise pool
  for (let i = 0; i < config.worker.concurrency; i++) {
    promisePool[i] = null
  }
```

Insert immediately BEFORE that block (after the `eventsQueue.start` block ends around line 53):

```ts
  // Startup memory budget report
  const containerLimitMB = detectContainerLimitMB()
  const hostTotalMB = Math.round(os.totalmem() / (1024 * 1024))
  const workerProcessRssMB = Math.round(process.memoryUsage().rss / (1024 * 1024))
  const budget = computeBudget({
    hostTotalMB,
    containerLimitMB,
    workerProcessRssMB,
    concurrency: config.worker.concurrency,
    taskMaxHeapMB: config.worker.task.maxHeapMB,
    warnThresholdPct: config.worker.task.memoryHeadroomWarnPct
  })
  const report = formatReport(budget)
  if (budget.status === 'ok') console.log(report)
  else console.warn(report)

  // Initialise the worker's own memory gauges and keep them fresh.
  updateWorkerMemoryGauges()
  const workerGaugeTimer = setInterval(updateWorkerMemoryGauges, config.worker.task.memorySampleIntervalMs)
  workerGaugeTimer.unref()
```

- [ ] **Step 8: Remove the now-unused `buildErrorMessageFromStderr` import if no longer needed**

Check whether `buildErrorMessageFromStderr` is still used in `worker.ts` (the new catch block still uses it as a fallback). If yes, keep the import. If TS reports it as unused, remove it.

Run: `npm run check-types`

- [ ] **Step 9: Lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 10: Smoke-test the change against the dev environment**

Per `AGENTS.md`, dev processes are managed by the user via zellij and the user manages restarts. **Do not restart the worker yourself.** Instead:

- Run `bash dev/status.sh` to confirm the worker is running.
- Run `tail -n 100 dev/logs/dev-worker.log` and verify the `[memory-budget]` startup line appears (the user will need to restart the worker manually to see it — if you don't see it, ask the user to restart the worker).

- [ ] **Step 11: Commit**

```bash
git add worker/src/worker.ts
git commit -m "feat(worker): per-task heap budget, slot tracking, OOM diagnostics"
```

---

## Task 8: Wire `processings.debug` field if missing

**Files:** (verify only — likely no changes)

- [ ] **Step 1: Verify `processing.debug` exists in the API schema**

Run: `grep -n '"debug"' api/types/processing/*.json shared/types/processing/*.json 2>/dev/null`
Expected: at least one match.

If no match, the field is referenced in `worker/src/task/task.ts:58` but absent from the schema. Add it to the relevant processing JSON schema as `"debug": { "type": "boolean", "default": false }`. (Likely already present — this task is a defensive check.)

- [ ] **Step 2: No commit if no changes**

Skip the commit if no files changed.

---

## Task 9: End-to-end OOM scenario

**Files:**
- Create: `tests/fixtures/plugins/oom-leak/package.json`
- Create: `tests/fixtures/plugins/oom-leak/index.js`
- Create: `tests/features/processings/memory-oom.e2e.spec.ts`

- [ ] **Step 1: Inspect existing e2e tests to match conventions**

Read one example to copy boilerplate:

Run: `ls tests/features/processings/ | head` then `head -60 tests/features/processings/<one of the e2e files>.spec.ts`
Use the imports, `axios` helper, and login pattern from the existing file. Confirm the test plugin loading convention (registry vs. local path) by reading `worker/src/task/task.ts:100-116` and any test that loads a local plugin.

- [ ] **Step 2: Create the leaky test plugin**

`tests/fixtures/plugins/oom-leak/package.json`:

```json
{
  "name": "@data-fair-tests/oom-leak",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "description": "Test plugin that intentionally allocates memory to trigger heap OOM."
}
```

`tests/fixtures/plugins/oom-leak/index.js`:

```js
export const run = async () => {
  // Allocate 50 MiB buffers in a tight loop. With WORKER_TASK_MAX_HEAP_MB=128
  // this exceeds the heap budget within a second or two.
  const sink = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    sink.push(Buffer.alloc(50 * 1024 * 1024).fill(1))
  }
}
```

- [ ] **Step 3: Write the failing e2e test**

`tests/features/processings/memory-oom.e2e.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import axios from '../../support/axios.ts'

// This test requires the worker to be running with WORKER_TASK_MAX_HEAP_MB=128
// (the default is 768; 128 reliably triggers heap OOM within seconds for the
// oom-leak fixture). The dev worker reads its env from .env per AGENTS.md, so
// the test starts by asking /api/v1/test-env to override the heap budget.

test('task killed by heap OOM produces oom-heap diagnostic and metrics counter', async ({ }) => {
  // Override worker config to a small heap budget for this test
  await axios.post('/api/v1/test-env/set-config', {
    'worker.task.maxHeapMB': 128
  })

  // Install the oom-leak plugin (mechanism depends on registry vs. local file).
  // If the test environment supports a local fixture path, point processing.plugin
  // at it. Otherwise, fall back to publishing it via the test registry helper.
  // (Adapt to the project's existing fixture-loading utility — see tests/support/*.)

  const processing = await axios.post('/api/v1/processings', {
    title: 'oom-leak-test',
    plugin: '@data-fair-tests/oom-leak',
    config: {},
    active: true,
    debug: false
  }).then(r => r.data)

  // Trigger a run
  const run = await axios.post(`/api/v1/processings/${processing._id}/_trigger`).then(r => r.data)

  // Poll until the run reaches a terminal state
  let final
  for (let i = 0; i < 60; i++) {
    final = await axios.get(`/api/v1/runs/${run._id}`).then(r => r.data)
    if (final.status === 'error' || final.status === 'finished' || final.status === 'killed') break
    await new Promise(r => setTimeout(r, 1000))
  }
  expect(final?.status).toBe('error')

  // Run log should contain the oom-heap diagnostic substring
  const logMsgs = (final?.log ?? []).map((l: any) => l.msg).join('\n')
  expect(logMsgs).toContain('heap OOM, exit code 134')
  expect(logMsgs).toContain('WORKER_TASK_MAX_HEAP_MB=128')

  // Prometheus counter incremented
  const metricsRes = await axios.get('http://localhost:9090/metrics', { baseURL: '' })
  expect(metricsRes.data).toMatch(/df_processings_runs_exited_total\{category="oom-heap"\} [1-9]/)

  // Cleanup
  await axios.delete(`/api/v1/processings/${processing._id}`)
  await axios.post('/api/v1/test-env/set-config', { 'worker.task.maxHeapMB': null }) // revert
})
```

If the project's plugin-loading convention requires more setup (registry tarball publish), look at `tests/support/` for a `publishFixturePlugin` helper and adapt step 3. Read `dev/resources/users.json` and the relevant support files to understand authentication; copy the auth pattern from a sibling e2e file rather than inventing one.

- [ ] **Step 4: Run the e2e test**

Run: `npx playwright test tests/features/processings/memory-oom.e2e.spec.ts --project e2e`
Expected: PASS.

If the run does not reach `oom-heap` in 60 s, lower the heap budget further (e.g. 96 MB) or increase the allocation size in the fixture. If the test fails because the test-env `set-config` route doesn't accept `worker.task.maxHeapMB`, inspect `api/src/routers/test-env.ts` (or equivalent) and extend it — but document the extension in this task before moving on.

- [ ] **Step 5: Commit**

```bash
git add tests/features/processings/memory-oom.e2e.spec.ts tests/fixtures/plugins/oom-leak/
git commit -m "test(e2e): heap OOM produces oom-heap diagnostic"
```

---

## Task 10: Documentation

**Files:**
- Modify: `README.md` or `docs/architecture/*.md` (find the appropriate location)

- [ ] **Step 1: Locate the right doc**

Run: `ls docs/architecture/ && grep -l -i "worker\|concurrency\|memory" docs/architecture/*.md`

Pick the worker-related architecture doc, or `README.md` if there's no worker-specific doc.

- [ ] **Step 2: Add a "Memory management" section**

Add (adapt to the chosen file's style):

```markdown
## Memory management

Task processings run as dedicated child processes for memory isolation. Each
child is spawned with an explicit `--max-old-space-size` limit so the V8 heap
cannot grow past the configured budget.

### Configuration

| Env var | Default | Purpose |
|---|---|---|
| `WORKER_CONCURRENCY` | 4 | Max concurrent task children |
| `WORKER_TASK_MAX_HEAP_MB` | 768 | Per-task V8 old-gen limit (--max-old-space-size) |
| `WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS` | 10000 | Memory sample cadence (0 disables periodic sampling) |
| `WORKER_TASK_MEMORY_HEADROOM_WARN_PCT` | 70 | Warn at startup when projected use leaves less than (100-X)% headroom |

`concurrency × task.maxHeapMB` is the upper bound on simultaneous heap
allocation. Operators should set `WORKER_TASK_MAX_HEAP_MB` so this product
fits the container memory limit with comfortable headroom.

### Startup sanity report

At boot the worker logs a single multiline `[memory-budget]` entry comparing
host total / container limit / worker RSS / projected concurrent task heap.
Status `OVERBUDGET` or `TIGHT` is logged at warn level.

### OOM diagnostics

When a child exits abnormally the run log gets an English diagnostic with a
category tag:

- `oom-heap` (exit code 134 / SIGABRT) — V8 heap budget exceeded
- `oom-host` (SIGKILL / exit code 137) — host or container OOM-killer
- `plugin-error` — non-zero exit with stderr context
- `unknown` — anything else

The diagnostic message includes the last memory sample reported by the child
(via the `df-mem:` stdout protocol), current concurrency, and remediation
hints.

### Metrics

The worker exposes prom-client-named gauges so standard Node.js Grafana
dashboards work out of the box:

- `process_resident_memory_bytes{kind, slot}`
- `nodejs_heap_size_total_bytes{kind, slot}`
- `nodejs_heap_size_used_bytes{kind, slot}`
- `nodejs_external_memory_bytes{kind, slot}`

`kind="worker"` represents the parent (no `slot` label); `kind="task"`,
`slot=0..N-1` represents each concurrent task slot.

Additional metrics:

- `df_processings_task_slot_state{slot}` — 0 idle, 1 running
- `df_processings_runs_exited_total{category}` — counter by exit category

### Debug-mode memory entries

Setting `processing.debug = true` on a processing causes its task to append
periodic `memory` entries to the run log (heap, RSS, external) at the same
cadence as `WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS`. Useful for diagnosing
a specific run without enabling cluster-wide debug logging.
```

- [ ] **Step 3: Lint markdown if there's a linter**

Run: `npm run lint` (covers eslint; markdown may be ignored)
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/architecture/*.md   # whichever was edited
git commit -m "docs: document memory budget, OOM diagnostics, and new metrics"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run all unit tests for this feature**

Run: `npx playwright test tests/features/worker-utils/memory-budget.unit.spec.ts tests/features/worker-utils/exit-code.unit.spec.ts tests/features/worker-utils/mem-sample.unit.spec.ts --project unit`
Expected: PASS.

- [ ] **Step 2: Run the e2e test**

Run: `npx playwright test tests/features/processings/memory-oom.e2e.spec.ts --project e2e`
Expected: PASS.

- [ ] **Step 3: Full quality gate**

Run: `npm run lint && npm run check-types && npm run build-types`
Expected: all exit 0.

- [ ] **Step 4: Inspect git log for the branch**

Run: `git log --oneline master..HEAD`
Expected: 8-10 focused commits matching the task structure.

- [ ] **Step 5: Open a PR (only if user confirms)**

Use the `superpowers:finishing-a-development-branch` skill to present merge/PR options. Do NOT push or create the PR autonomously.

---

## Self-review notes (filled in after writing this plan)

- All five units from the spec have a task (Task 1: config; Task 2: mem-sample; Task 3: exit-code; Task 4: memory-budget; Task 5: metrics; Task 6: memory-reporter; Task 7: worker.ts integration).
- Testing requirements from spec §6: covered by Tasks 2, 3, 4, 9. Worker-side stdout demux is unit-tested via `splitMemSampleLines` in Task 2; the full integration is exercised by Task 9.
- French/English convention: documented in Task 7's catch-block message (English diagnostics) and in the docs in Task 10. Existing French strings in `task.ts:85,198,206` are not touched.
- `--optimize-for-size` policy: spec calls it out as documentation-only; Task 10 covers it in the docs section (extend the section if you want to record the policy there too).
- Open question on `gracePeriod` ↔ `oom-host` interaction: documented in the spec; no task required (out of scope).
