# External task resource sampler

## Problem

Per-task memory and process metrics are currently emitted from inside each
task child process: `worker/src/task/memory-reporter.ts` runs a `setInterval`
that calls `process.memoryUsage()` and writes `df-mem:<json>` lines to
stdout, which the parent worker demuxes to update Prometheus gauges and to
stash a "last memory sample" for the OOM diagnostic.

A CPU-bound plugin can saturate the child's event loop and starve that
sampler — gauges go stale, the debug `run.log` entry is not written, and
the `lastMem` attached to an `oom-host` diagnostic may be many seconds old
at the moment of the kernel kill. The signal is least available exactly
when the operator most needs it.

## Goal

Collect per-task RSS and CPU usage from the parent worker process so the
observation cadence is independent of the child's event loop.

## Non-goals

- **No kill behaviour.** The sampler is observe-only. No new
  `WORKER_TASK_MAX_RSS_MB`, no new `oom-rss` exit category. (Explicit
  decision: kernel/cgroup OOM-killing remains the only RSS enforcement
  path.)
- **No subprocess walking.** Only the immediate task child's `/proc/<pid>`
  is sampled. Plugins that spawn heavy subprocesses (e.g. a Python helper)
  will under-report RSS; the cgroup-level OOM-killer remains the safety
  net.
- **No cross-platform parity.** Linux only. On macOS/Windows the sampler
  logs a one-line skip notice and stays disabled.
- **No new histograms.** A peak-heap-on-completion histogram is already
  noted as a forward item in `docs/architecture/memory-management.md` and
  remains out of scope.

## Approach

The parent worker reads `/proc/<pid>/status` (VmRSS) and `/proc/<pid>/stat`
(utime, stime) on the same cadence as the in-process sampler. Per-slot
state stores the previous CPU-ticks snapshot to compute a CPU usage ratio
between ticks.

Authority for the existing RSS gauge moves from the in-process df-mem
writer to the new external sampler. The in-process sampler keeps writing
heap totals/used/external (V8-internal — only the child can see them).

### Components

```
worker/src/utils/proc-stat.ts          # pure procfs reader + CPU ratio math
worker/src/task/external-sampler.ts    # parent-side per-slot timer + state
worker/src/utils/metrics.ts            # +cpuRatioGauge, +updateTaskExternalGauges
worker/src/worker.ts                   # iter(): start sampler after spawn, stop on close
worker/src/utils/exit-code.ts          # diagnoseExit: accept lastExt, render in admin msg
```

### `proc-stat.ts` — pure utility

```ts
export type ProcStatSnapshot = {
  rssBytes: number     // /proc/<pid>/status VmRSS, kB * 1024
  utimeTicks: number   // /proc/<pid>/stat field 14
  stimeTicks: number   // /proc/<pid>/stat field 15
  readAt: number       // Date.now() at read
}

export const isSupported: () => boolean
export const readProcStat: (pid: number) => ProcStatSnapshot | null
export const computeCpuRatio: (
  prev: Pick<ProcStatSnapshot, 'utimeTicks' | 'stimeTicks' | 'readAt'>,
  curr: Pick<ProcStatSnapshot, 'utimeTicks' | 'stimeTicks' | 'readAt'>,
  clockTicksPerSec: number
) => number
```

- `isSupported()` checks `/proc/self/stat` existence once at module load.
- `readProcStat(pid)` returns `null` on `ENOENT` (PID gone) — caller must
  treat this as a stop signal. Other read errors throw so the sampler can
  log+stop deliberately.
- `/proc/<pid>/stat` parser slices from the **last** `)` to handle process
  names containing spaces or parens (the canonical robust approach). After
  the slice, fields 14 and 15 of the original spec are indices 11 and 12
  of the remainder.
- `computeCpuRatio` returns `((Δutime + Δstime) / clockTicksPerSec) /
  (Δwall_ms / 1000)`. Returns 0 when `Δwall_ms <= 0` or any delta is
  negative (defensive).

#### CLK_TCK detection

`process` does not expose `sysconf(_SC_CLK_TCK)`. Resolution order, once
at module load:

1. `execSync('getconf CLK_TCK')` — works on any glibc/musl Linux.
2. Fallback to `100` if `getconf` is missing or fails.

100 is the kernel default `CONFIG_HZ=100` on every distro we ship to and
the standard fallback.

### `external-sampler.ts` — parent-side lifecycle

```ts
export type ExternalSample = {
  rssBytes: number
  cpuRatio: number | null   // null on the first sample (no baseline)
  readAt: number
}

export type ExternalSamplerHandle = { stop: () => void }

export const startExternalSampler: (
  slot: number,
  pid: number,
  intervalMs: number,
  onSample: (s: ExternalSample) => void
) => ExternalSamplerHandle
```

Behaviour:

1. Synchronously capture a baseline `readProcStat(pid)`.
   - If `null` (child died between spawn and sampler start — extremely
     rare), return a no-op `{ stop: () => {} }` handle; no gauges
     updated, no `onSample` call.
   - Otherwise emit an `ExternalSample` with `cpuRatio: null`, update
     gauges, call `onSample`.
2. `setInterval` at `intervalMs`. Each tick:
   - `readProcStat(pid)` → if `null`, `stop()` and return.
   - Compute `cpuRatio` against the previous snapshot.
   - Update gauges via `updateTaskExternalGauges(slot, sample)`.
   - Call `onSample(sample)`.
   - Replace the previous snapshot with the current one.
3. Non-ENOENT errors: warn once per slot, stop the timer for that slot
   (a single permanently-broken procfs would otherwise spam logs).
4. `intervalMs <= 0` disables periodic sampling but still emits the
   baseline (matches the in-process sampler's convention).
5. `onSample` callback errors are swallowed (best-effort, mirrors the
   debug-log path in the in-process sampler).
6. `stop()` is idempotent — safe to call from multiple paths.

### `metrics.ts` changes

```ts
const cpuRatioGauge = new Gauge({
  name: 'df_processings_process_cpu_usage_ratio',
  help: 'Per-process CPU usage as a fraction of one core over the last sample window (1.0 = one full core)',
  labelNames: ['kind', 'slot']
})

export const updateTaskExternalGauges = (slot: number, ext: ExternalSample): void
// sets rssGauge({kind:'task', slot}, ext.rssBytes)
// sets cpuRatioGauge({kind:'task', slot}, ext.cpuRatio ?? 0)
```

`updateTaskMemoryGauges` (existing in-process path) **stops writing**
`rssGauge`. It keeps writing `heapTotalGauge`, `heapUsedGauge`,
`externalGauge`. The RSS gauge semantics shift from "child-reported" to
"parent-observed" for `kind="task"`; for `kind="worker"` it remains
self-reported (the worker's event loop is not at risk of plugin
saturation).

When the external sampler is disabled at startup (non-Linux or feature
flag), the in-process sampler's `rssGauge` write is re-enabled — the
behaviour change must not regress dev environments. Implementation:
`updateTaskMemoryGauges` reads a module-level boolean
`externalRssActive` (set once at boot) and conditionally writes `rssGauge`.

### `worker.ts::iter()` wiring

Insert after `pids[run._id] = child.pid || -1; setSlotState(freeSlot, true)`:

```ts
let lastExt: ExternalSample | null = null
const sampler = child.pid && externalRssActive
  ? startExternalSampler(freeSlot, child.pid, config.worker.task.memorySampleIntervalMs,
      (ext) => { lastExt = ext })
  : null
```

In the existing `child.on('close', …)` handler, stop the sampler **before**
`setSlotState(freeSlot, false)` so no tick fires against an idle slot.
Also call `sampler?.stop()` from the `child.on('error', …)` listener for
spawn failures that fire `error` without a subsequent `close`. `stop()`
is idempotent so the duplicate-stop on the normal path is harmless.

`diagnoseExit` gains a `lastExt: ExternalSample | null` parameter, passed
through alongside the existing `lastMem`.

### Diagnostic rendering rules in `exit-code.ts`

| Category | Primary | Secondary line (if available) |
|---|---|---|
| `oom-host` | external RSS (`Last seen RSS (external)`) + CPU ratio | child-reported heap from `lastMem` |
| `oom-heap` | child-reported heap/RSS from `lastMem` (V8-internal) | external RSS + CPU ratio |
| `plugin-error` | stderr-derived message (unchanged) | external RSS + CPU ratio if available |
| others | unchanged | external RSS + CPU ratio if available |

CPU ratio is informative for `oom-host`: near 0 hints at slow leak on a
quiet task, near 1.0 hints at allocation-during-CPU-saturation — exactly
the case this sampler was added to observe.

### Configuration

| Key | Default | Env var | Notes |
|---|---|---|---|
| `worker.task.externalSamplerEnabled` | `true` | `WORKER_TASK_EXTERNAL_SAMPLER_ENABLED` | Master flag. Auto-flipped to `false` at boot when `proc-stat.isSupported()` is false. |

No new interval knob — reuses `WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS`.

### Failure modes & boundary cases

- **PID disappears between ticks**: `readProcStat` returns `null`, sampler
  stops silently, `child.on('close')` fires shortly after.
- **Procfs unreadable** (permissions, exotic kernel): non-ENOENT error
  → log warn once with slot + pid + errno, stop the timer for that slot.
  Other slots continue.
- **CLK_TCK detection fails**: fall back to 100, log a one-line info at
  boot. CPU ratio remains usable.
- **Slot reuse**: previous run's sampler is `stop()`-ed in the close
  handler. The next `startExternalSampler` call creates a fresh baseline
  — no cross-run CPU delta contamination.
- **Child spawned but `pid` is `undefined`** (very rare spawn error path):
  no sampler started, `lastExt` stays `null`, diagnostic falls back to
  current rendering.

## Tests

### Unit — `tests/features/worker-utils/proc-stat.unit.spec.ts`

Pure-function tests, parser fed strings:

- `parseStatusVmRss`: happy path, missing line, malformed kB unit, extra
  whitespace.
- `parseStatFields`: name with spaces in parens, name containing `)`,
  name with newlines (rare but legal).
- `computeCpuRatio`: one core (~1.0), idle (0), multi-core (>1.0), zero
  wall delta returns 0, negative deltas return 0.
- `readProcStat(process.pid)`: sanity — returns plausible non-zero
  rssBytes and ticks.
- `readProcStat(99999)`: returns `null` without throwing.
- `isSupported()`: gated to `process.platform === 'linux'`.

### Unit — `tests/features/worker-utils/external-sampler.unit.spec.ts`

Drives the sampler via DI (factory accepts an injected `readProcStat` for
testability):

- First tick: emits `cpuRatio: null` and the baseline RSS.
- Second tick: emits computed `cpuRatio`.
- Reader returns `null` → sampler stops itself, no further ticks.
- `stop()` cancels the timer.
- Callback throwing does not crash the sampler.

### Unit — extend `tests/features/worker-utils/exit-code.unit.spec.ts`

`diagnoseExit` gains a `lastExt` parameter — new cases:

- `oom-host` with `lastExt` set: admin message contains
  `Last seen RSS (external)` and the CPU ratio line.
- `oom-host` with `lastExt: null`: falls back to current text — no
  regression.
- `oom-heap` with both `lastMem` and `lastExt`: heap line is primary,
  external RSS is secondary.

### e2e — extend `tests/features/processings/memory-oom.e2e.spec.ts`

New fixture `tests/fixtures/processing-cpu-leak/` — busy-loop
(`while(Date.now()-t < 50){}`) interleaved with allocations of a few MB
per iteration. The test snapshots the per-slot RSS gauge value before
the run, triggers the run, waits for completion/crash, then asserts the
gauge moved (proving the external sampler kept reporting through CPU
saturation). Skipped on non-Linux.

### Unit — extend `tests/features/worker-utils/memory-budget.unit.spec.ts`

No changes needed — startup budget report is independent of the sampler.

## Documentation

`docs/architecture/memory-management.md` is the home for this. Extend in
place rather than create a new file:

- **"Sampling cadence"** — add a "Sources" paragraph explaining the
  two-writer model: external is authoritative for RSS, in-process is
  authoritative for heap-internal counters.
- **New "External sampler" subsection** between "Sampling cadence" and
  "Metrics" — procfs reader, CLK_TCK detection, failure modes, platform
  gate.
- **"Metrics" table** — add `df_processings_process_cpu_usage_ratio`
  row; footnote that `df_processings_process_resident_memory_bytes` for
  `kind="task"` is parent-observed.
- **"Configuration" table** — add `externalSamplerEnabled` row.

`worker/config/type/schema.json` — add the `task.externalSamplerEnabled`
property with the same default + description.

`worker/config/custom-environment-variables.mjs` — add the
`WORKER_TASK_EXTERNAL_SAMPLER_ENABLED` binding (boolean-coerced).

## Commits / PR shape

Single PR on branch `perf-task-resource-metrics`. Commits in
implementation order so the reviewer can read the diff per concern:

1. `feat(worker): proc-stat utility for reading /proc/<pid>` — pure
   module + unit tests.
2. `feat(worker): external sampler wired into iter() lifecycle` — sampler
   module + worker.ts changes + new metric gauge + RSS authority shift
   in metrics.ts + unit tests.
3. `feat(worker): include external RSS/CPU% in OOM diagnostic` —
   exit-code.ts changes + unit-test extensions.
4. `test(e2e): cpu-saturated task still reports RSS externally` — new
   fixture + e2e case.
5. `docs(memory): document external sampler and metric semantics shift`.
6. `chore(config): add externalSamplerEnabled knob + env binding`.
