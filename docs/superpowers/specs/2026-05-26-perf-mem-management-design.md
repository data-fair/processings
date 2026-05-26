# Memory pressure diagnostics and heap budget for processings worker

Status: design  Date: 2026-05-26  Branch: `perf-mem-management`

## Problem

In resource-restricted environments the processings worker spawns task child
processes that occasionally die with exit code 134 (SIGABRT — typically V8
heap-out-of-memory). The current code surfaces this as a generic
`child process exited with code 134` log line. Admins have no signal about
heap usage, container budget, concurrency math, or whether the cause was a
plugin leak versus an under-sized container.

This spec addresses three gaps:

1. There is no explicit V8 heap limit on the child task processes — they run
   with Node's default heap (~1.4 GB on 64-bit), often larger than the
   container budget can absorb when multiplied by concurrency.
2. No memory observability: no `process.memoryUsage()` reporting, no metrics,
   no last-known heap captured at crash time.
3. No upfront sanity check comparing `concurrency × maxHeap` to the effective
   container memory limit.

## Out of scope

- Switching from child processes to worker threads. A separate analysis
  (documented in the "Migration analysis" section below) concluded the payoff is modest
  and the risks (native-addon thread safety, plugin `process.exit()`,
  cross-task contamination) are real given the registry's plugin
  trust model. The diagnostics shipped here will give us real data to
  revisit that decision later if needed.
- Per-processing heap overrides.
- Auto-tuning `maxHeapMB` from detected container memory. The startup sanity
  check surfaces the comparison so operators can pick a number explicitly.
- Internationalisation of the new diagnostic messages.

## Approach

Keep the child-process execution model. Add five focused units:

1. Heap-budget config block (`worker.task.*`) — env-var-overridable.
2. `memory-budget.ts` — startup sanity report comparing configured budget
   against effective container memory.
3. `exit-code.ts` — pure function categorising child exit into
   `success | sigterm | oom-heap | oom-host | plugin-error | unknown`,
   producing an English admin-facing message.
4. `memory-reporter.ts` (runs inside the child) — emits
   `process.memoryUsage()` samples to stdout, and (when
   `processing.debug`) directly writes mongo run-log entries.
5. Worker stdout demux + Prometheus gauges keyed by task slot.

## Components

### Configuration

New block in `worker/config/default.mjs`, schema in
`worker/config/type/schema.json`, env bindings in
`worker/config/custom-environment-variables.mjs`.

```js
worker: {
  // ...existing keys (concurrency, interval, killInterval, gracePeriod, etc.)
  task: {
    maxHeapMB: 768,                 // env: WORKER_TASK_MAX_HEAP_MB
    memorySampleIntervalMs: 10000,  // env: WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS
    memoryHeadroomWarnPct: 30       // env: WORKER_TASK_MEMORY_HEADROOM_WARN_PCT
  }
}
```

- `maxHeapMB` is passed to the child as `--max-old-space-size=<n>` in
  argv (not `NODE_OPTIONS`) so it's visible in process listings.
- 768 MB default leaves a 4 GB container comfortably fitting
  `concurrency=4 × 768 MB = 3 GB` of task heap plus worker baseline.
- `memorySampleIntervalMs` controls both the stdout metrics tick and the
  debug-mode run-log tick (kept synchronised so the timeline matches).
- `memoryHeadroomWarnPct` is the headroom percentage below which startup
  emits a warning. Default 30 = warn when headroom drops below 30% of
  effective memory (i.e. projected usage > 70%). Independent of `task`
  execution but lives in the same config block for proximity.

### `memory-budget.ts`

Path: `worker/src/utils/memory-budget.ts` (new).

Pure compute + a small filesystem probe. Called once from `worker.ts`
during startup, before the polling loop.

```ts
type MemoryBudgetReport = {
  hostTotalMB: number              // os.totalmem()
  containerLimitMB: number | null  // cgroup v2 memory.max, or null
  effectiveLimitMB: number         // min(containerLimit ?? Infinity, hostTotal)
  workerProcessRssMB: number       // current process.memoryUsage().rss
  concurrency: number
  taskMaxHeapMB: number
  projectedTaskHeapMB: number      // concurrency * taskMaxHeapMB
  headroomPct: number              // 100 * (effective - workerRss - projected) / effective
  warnThresholdPct: number
  status: 'ok' | 'tight' | 'overbudget'
}

export const detectContainerLimitMB = (cgroupPath?: string): number | null
export const computeBudget = (input: ...): MemoryBudgetReport
export const formatReport = (r: MemoryBudgetReport): string
```

- Container detection reads cgroup v2 `/sys/fs/cgroup/memory.max` first,
  falls back to cgroup v1 `/sys/fs/cgroup/memory/memory.limit_in_bytes`.
  `"max"` → null. Read errors → null. Mac/Windows → null.
- Status:
  - `overbudget` — `projected + workerRss > effective`
  - `tight` — `headroomPct < warnThresholdPct`
  - `ok` — otherwise
- Behaviour: log only. Do not refuse to start.

Startup log line (single multi-line entry via existing pino logger):

```
[memory-budget] host=8192MB container=2048MB effective=2048MB worker-rss=72MB
                concurrency=4 task-max-heap=768MB projected-task-heap=3072MB
                headroom=-1096MB (-53%) status=OVERBUDGET
[memory-budget] WARNING: concurrency × task.maxHeapMB exceeds effective memory limit.
                Reduce WORKER_CONCURRENCY or WORKER_TASK_MAX_HEAP_MB, or raise the container limit.
```

Logged at `warn` level for `tight`/`overbudget`, `info` for `ok`.

### `exit-code.ts`

Path: `worker/src/utils/exit-code.ts` (new). Pure function, no side effects.

```ts
type ExitCategory = 'success' | 'sigterm' | 'oom-heap' | 'oom-host'
                  | 'plugin-error' | 'unknown'

type ExitDiagnosis = {
  category: ExitCategory
  adminMessage: string
  logType: 'info' | 'debug' | 'error'
}

export const diagnoseExit = (
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
  lastMem: MemorySample | null,
  context: {
    maxHeapMB: number
    concurrency: number
    runningTasks: number
  }
): ExitDiagnosis
```

Decision table (first match wins):

| code | signal | stderr | Category | logType |
|---|---|---|---|---|
| `0` | `null` | — | `success` | (no entry) |
| any | `SIGTERM` (or `143`) | — | `sigterm` | (silent, existing path) |
| any | `SIGKILL` (or `137`) | — | `oom-host` | `error` |
| `134` | `null` or `SIGABRT` | — | `oom-heap` | `error` |
| `1` | `null` | non-empty (filtered) | `plugin-error` | `error` |
| else | — | — | `unknown` | `error` |

Stderr text for `oom-heap` is checked but not required: a 134 exit with
no heap hint in stderr is still treated as `oom-heap` (V8 sometimes aborts
before flushing). The admin message reflects this with "likely".

Admin messages (English):

- `oom-heap`:
  ```
  Task exceeded the JavaScript heap limit (heap OOM, exit code 134).
  Last memory sample — heap used: <X> MB / <maxHeapMB> MB; RSS: <Y> MB.
  Concurrent tasks at exit: <n> / concurrency <c>.
  Configuration: WORKER_TASK_MAX_HEAP_MB=<maxHeapMB>.
  Mitigation: raise WORKER_TASK_MAX_HEAP_MB, lower WORKER_CONCURRENCY,
  or inspect the plugin for a memory leak.
  ```

- `oom-host`:
  ```
  Task killed by the OS (SIGKILL, likely container OOM-killer).
  Last memory sample — heap used: <X> MB / <maxHeapMB> MB; RSS: <Y> MB.
  The container memory limit was probably exceeded.
  Mitigation: raise the container memory limit, or lower WORKER_CONCURRENCY.
  ```

- `plugin-error`: existing behaviour — filtered stderr from
  `buildErrorMessageFromStderr` (`worker-operations.ts:8-20`), logged as
  `error`.

- `unknown`: `Task ended unexpectedly (code=X, signal=Y).` plus any stderr.

If `lastMem` is null: substitute
`no memory sample was reported before exit` for the memory line.

Project convention is French for end-user-facing run log messages
(`task.ts:85,112`). These admin diagnostics are explicitly English because
they target ops/admin readers and align with the vocabulary of Node/V8
errors, env var names, and metric labels.

### `memory-reporter.ts`

Path: `worker/src/task/memory-reporter.ts` (new, runs inside the child).

Two outputs from a single timer:

```ts
export const startMemoryReporter = (
  processing: Processing,
  pushLog: (entry: { type: string, msg: string, extra?: string }) => Promise<void>,
  intervalMs: number
) => {
  const emitToStdout = (phase: 'startup' | 'running' | 'exit') => {
    const m = process.memoryUsage()
    const line = `df-mem:${JSON.stringify({ t: Date.now(), phase, ...m })}\n`
    process.stdout.write(line)
  }
  const emitToRunLog = async () => {
    const m = process.memoryUsage()
    await pushLog({ type: 'debug', msg: 'memory', extra: formatMem(m) })
  }

  emitToStdout('startup')
  let timer: NodeJS.Timeout | undefined
  if (intervalMs > 0) {
    timer = setInterval(() => {
      emitToStdout('running')
      if (processing.debug) void emitToRunLog()
    }, intervalMs)
    timer.unref()
  }
  process.on('exit', () => {
    if (timer) clearInterval(timer)
    emitToStdout('exit') // synchronous; survives SIGABRT/SIGKILL
  })
}
```

Wire format on stdout, line-delimited JSON with a `df-mem:` prefix:

```
df-mem:{"t":1748256123456,"phase":"running","rss":124583936,"heapTotal":67108864,"heapUsed":48235104,"external":2103312,"arrayBuffers":1048576}
```

- Periodic stdout samples: **always on**, drive parent-side Prometheus
  gauges. Cost is ~120 B / interval / running task.
- Periodic mongo run-log entries: **only when `processing.debug`**.
  Independent of stdout samples, uses the existing `pushLog` path
  (same as `log.debug`).
- Exit sample: **always emitted synchronously**. The mongo write path
  cannot complete during `'exit'` (no event loop), but the synchronous
  `process.stdout.write` to an already-piped fd does land in the parent's
  buffer.

Periodic mongo writes are async-but-not-awaited from the timer (`void
emitToRunLog()`) so a slow mongo write doesn't drift the sample cadence;
order is preserved by mongo's per-document update serialisation.

### Worker stdout demux and Prometheus

Path: `worker/src/worker.ts` (modified around lines 212–258).

#### Spawn

```ts
const child = spawn('node', [
  `--max-old-space-size=${config.worker.task.maxHeapMB}`,
  '--disable-warning=ExperimentalWarning',
  './src/task/index.ts',
  run._id, processing._id
], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
```

#### Slot tracking

`promisePool` (currently `[Promise<void> | null]` at `worker.ts:27,56-58`)
gains parallel slot metadata so each running child knows its slot index:

```ts
type Slot = { task: Promise<void>, runId: string, child: ChildProcess } | null
const slots: Slot[] = []
for (let i = 0; i < config.worker.concurrency; i++) slots[i] = null
```

The acquire logic (`Promise.any(promisePool)` style) is replaced by
selecting the first `null` index; the released slot is set back to `null`
on `close`.

#### Stdout demux

```ts
let stdoutResidual = ''
let lastMem: MemorySample | null = null

child.stdout.on('data', chunk => {
  const text = stdoutResidual + chunk.toString('utf8')
  const lines = text.split('\n')
  stdoutResidual = lines.pop() ?? ''
  for (const line of lines) {
    if (line.startsWith('df-mem:')) {
      const snap = parseMemSample(line)
      if (snap) {
        lastMem = snap
        updateMemoryGauges(snap, { kind: 'task', slot: String(slotIndex) })
      }
    } else if (line === '<running>') {
      // existing handshake (task.ts:88)
    }
  }
})
```

`parseMemSample` returns `null` on malformed JSON; bad data is dropped
silently (a plugin printing `df-mem:` text won't crash anything).

#### Prometheus metrics

Register gauges in `worker/src/utils/metrics.ts` using prom-client's
standard default-metric names. **Do not call `collectDefaultMetrics()`**;
those names would collide.

```ts
const memoryGauges = {
  rss:        new Gauge({ name: 'process_resident_memory_bytes', help: '...', labelNames: ['kind', 'slot'] }),
  heapTotal:  new Gauge({ name: 'nodejs_heap_size_total_bytes',   help: '...', labelNames: ['kind', 'slot'] }),
  heapUsed:   new Gauge({ name: 'nodejs_heap_size_used_bytes',    help: '...', labelNames: ['kind', 'slot'] }),
  external:   new Gauge({ name: 'nodejs_external_memory_bytes',   help: '...', labelNames: ['kind', 'slot'] }),
}

const slotStateGauge = new Gauge({
  name: 'df_processings_task_slot_state',
  help: '0=idle, 1=running',
  labelNames: ['slot']
})

const exitedCounter = new Counter({
  name: 'df_processings_runs_exited_total',
  help: 'Task run exits by category',
  labelNames: ['category']
})
```

Label conventions:

- Worker parent: `kind="worker"`, no `slot` label. Updated on the same
  `memorySampleIntervalMs` cadence from the worker's own
  `process.memoryUsage()`.
- Task children: `kind="task"`, `slot="<0..concurrency-1>"`. Updated from
  parsed stdout samples.

Cardinality is bounded: `concurrency + 1` time series per gauge. Slots are
reused (no `.remove()` needed); stale gauge values between tasks reflect
the last reading and are accurate to "slot idle, last task ended at X
heap".

#### Close handler

```ts
child.on('close', (code, signal) => {
  const diag = diagnoseExit(
    code, signal, stderrBuf, lastMem,
    {
      maxHeapMB: config.worker.task.maxHeapMB,
      concurrency: config.worker.concurrency,
      runningTasks: countRunningSlots()
    }
  )
  exitedCounter.inc({ category: diag.category })
  slotStateGauge.set({ slot: String(slotIndex) }, 0)
  if (diag.category === 'sigterm') {
    // existing 'killed' path
  } else if (diag.category === 'success') {
    resolveTask()
  } else {
    rejectTaskWith(diag)
  }
})
```

In the catch branch of `iter()`:

```ts
await finish(run, diag.adminMessage, diag.logType)
```

`finish()` in `utils/runs.ts:60-71` already accepts an `errorLogType`
parameter. The diagnostic path passes `'error'` (currently the default is
`'debug'`); existing call sites are unchanged.

## Data flow

```
Child process                                Parent worker
─────────────                                ─────────────
spawn (argv: --max-old-space-size=N)
                                             slot allocator picks i
                                             slots[i] = { runId, child, ... }
startMemoryReporter()
  emit('startup') ──── df-mem:{...} ────►   parseMemSample
                                             updateMemoryGauges(kind=task, slot=i)
plugin runs ...
  (every Ns)
  emit('running') ──── df-mem:{...} ────►   updateMemoryGauges(...)
  if debug: pushLog(memory) → mongo ─────►  (visible in UI run page)
plugin throws / heap OOM / SIGKILL
  process.on('exit')
  emit('exit') ──── df-mem:{...} ────────►  lastMem captured
                                             on 'close':
                                               diagnoseExit(code, signal, stderr, lastMem)
                                               finish(run, msg, 'error')
                                               exitedCounter.inc({ category })
                                               slotStateGauge.set(0)
                                               slots[i] = null
```

## Error handling

| Failure mode | Behaviour |
|---|---|
| Child OOM (heap limit hit) | Exit 134 → `oom-heap` diagnosis with last-known heap in message |
| Container OOM-killer | Signal SIGKILL → `oom-host` diagnosis |
| Plugin throws | Existing `plugin-error` path, stderr filtered |
| Plugin calls `process.exit(N)` with N ≠ 0 | `unknown` diagnosis with raw code |
| Stdout sample has malformed JSON | Silently dropped; `lastMem` keeps prior value |
| Child dies before emitting any sample | `lastMem` null; diagnostic message says "no memory sample was reported before exit" |
| Mongo write of debug log fails | `void emitToRunLog()` swallows the error; next tick retries |
| cgroup file unreadable | `containerLimitMB = null`; startup report shows `container=unknown`, headroom calculated against host total |

## Testing

`tests/features/memory-management/` (new directory).

1. **`exit-code.unit.spec.ts`** — table-driven cases for every row of the
   decision table. Pure function, no I/O. Assertions on `category`,
   `logType`, and substrings of `adminMessage`.

2. **`memory-budget.unit.spec.ts`** —
   `computeBudget` table-driven (ok/tight/overbudget);
   `detectContainerLimitMB` parameterised on a temp file path so we don't
   touch real `/sys/fs/cgroup`. Cases: `"max"`, valid bytes, missing file,
   garbage.

3. **`memory-reporter.unit.spec.ts`** — spy `process.stdout.write` and the
   `pushLog` callback. Drive the reporter with synthetic `processing.debug`
   and fake timers. Assert: correct number of stdout lines, each parseable
   as `df-mem:` JSON with expected phase, debug log entries only when
   debug flag is true.

4. **Stdout demux** — pure parser, `splitMemLines(chunk, residual)`. Cases:
   empty chunk, full line, partial line spanning two chunks, malformed
   JSON after the `df-mem:` prefix, mixed with the `<running>` handshake.

5. **`oom.e2e.spec.ts`** — uses the real dev environment per
   `AGENTS.md`. Synthetic test plugin under
   `tests/fixtures/plugins/oom-leak/` allocates `Buffer.alloc(50_000_000)`
   in a loop. With `WORKER_TASK_MAX_HEAP_MB=128` the run reliably hits
   the heap limit. Assert:
   - `run.log` contains an `oom-heap` entry (substring "heap OOM, exit code 134").
   - `/metrics` shows `df_processings_runs_exited_total{category="oom-heap"} >= 1`.
   - Slot gauge returned to `0` (idle).

6. **Startup sanity report** — capture pino output during worker boot in
   an existing api/worker test and assert the `[memory-budget]` line is
   present with the expected status given test config.

Explicitly out of test scope:
- SIGKILL e2e (OS oom-killer not deterministic in CI). Unit-tested
  instead by injecting `{ code: null, signal: 'SIGKILL' }` directly into
  the close handler.
- Performance benchmarks of fork overhead.
- prom-client wire-format assertions beyond "metric registered and
  updated".

## Migration analysis (informational)

We considered switching task isolation from child processes to worker
threads (the path data-fair took in commit `2c14bb552`). Decision: keep
child processes for now. Reasoning:

- Native addons in plugins are common (`gdal-tools`, `gmp`, `tippecanoe`
  are baked into the worker image). Not all are thread-safe; a single
  bad addon can destabilise the worker.
- Plugin `process.exit()` would kill the worker, not just the task.
- Cross-task contamination of globals, intervals, file descriptors in a
  shared thread requires aggressive thread recycling, which erases most
  of the overhead win.
- Worker threads do not directly help the OOM problem — that's solved by
  setting an explicit heap limit (which we do regardless of execution
  model).
- The main thread-side win — lower per-task baseline and easier metrics
  aggregation — is modest because processings tasks run for seconds to
  hours.

The diagnostics we ship here will produce the heap-usage data needed to
re-evaluate the migration with evidence later.

## Rollout notes

- Default `WORKER_TASK_MAX_HEAP_MB=768` may surprise deployments that
  currently rely on Node's implicit 1.4 GB heap and have tasks just
  under it. Release notes must call this out. Operators can set the env
  var explicitly to preserve prior behaviour.
- The new `df_processings_runs_exited_total{category}` counter and the
  prom-client-named gauges are additive; no existing metrics removed.
- Existing `worker/src/utils/metrics.ts` keeps its `df_processings_runs`
  histogram unchanged.
- No changes to plugin API.
- **`--optimize-for-size` policy**: the worker parent keeps the existing
  `--optimize-for-size` flag (`Dockerfile:111`) — it's I/O-bound and
  benefits from a smaller V8 baseline. Task child processes do **not**
  inherit it (they're spawned with their own argv) and we deliberately
  do not add it: plugin code is often CPU-bound (parsing, transforms),
  and the flag slows JIT-optimised paths. Faster tasks finish slots
  sooner, which reduces concurrent peak heap pressure — the opposite of
  the optimisation's intent here. This is documented so the choice
  isn't folklore.

## Open questions / follow-ups (not in this spec)

- Should `gracePeriod` interact with the OOM diagnostic? Currently a SIGTERM
  during grace produces `sigterm` (silent kill). If we want to distinguish
  "killed during grace because OOM was approaching" from "user-initiated
  kill", that's a future refinement.
- A future `df_processings_task_slot_state` panel in the standard
  ops dashboard would benefit from a Grafana template; out of scope
  here (dashboard repo is separate).
- Re-evaluate worker_threads migration once we have ~3 months of heap
  data from production.
