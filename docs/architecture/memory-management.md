# Memory management

Task processings run as dedicated child processes for memory isolation.
Each child is spawned with an explicit `--max-old-space-size` limit so a
single runaway plugin cannot grow its V8 heap beyond the configured
budget.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `WORKER_CONCURRENCY` | 4 | Max concurrent task children |
| `WORKER_TASK_MAX_HEAP_MB` | 768 | Per-task V8 old-generation heap limit (`--max-old-space-size`) |
| `WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS` | 10000 | Cadence at which the child task samples `process.memoryUsage()` and emits stdout / debug-log entries (0 disables periodic sampling; an exit-time sample is still emitted on graceful exits) |
| `WORKER_TASK_MEMORY_HEADROOM_WARN_PCT` | 30 | Headroom percent below which the startup sanity report logs a warning |

Operators should size `WORKER_TASK_MAX_HEAP_MB` so
`WORKER_CONCURRENCY × WORKER_TASK_MAX_HEAP_MB` plus the worker baseline
(~70-100 MB) comfortably fits the container memory limit.

### What `--max-old-space-size` does and does NOT bound

`--max-old-space-size` caps V8's old-generation heap — `process.memoryUsage().heapTotal`
and `heapUsed`. It does **not** cap:

- `process.memoryUsage().external` — memory backing `Buffer`, `ArrayBuffer`,
  raw `Uint8Array`, certain native-addon allocations.
- `process.memoryUsage().rss` — total resident memory, includes external,
  arrayBuffers, and code/stack.

In practice that means a plugin that holds large `Buffer` references can
exceed the container's memory limit without ever triggering an `oom-heap`
diagnostic — the kernel OOM-killer kills the process first, producing an
`oom-host` diagnostic instead. If you see `oom-host` events for plugins that
allocate via `Buffer` / streams, raise the container budget rather than the
V8 heap limit.

## Startup sanity report

At boot the worker logs a single multi-line `[memory-budget]` entry
comparing host total, container limit (when readable from cgroups), worker
RSS, and `concurrency × task.maxHeapMB`. Status `OVERBUDGET` or `TIGHT` is
logged at `warn` level; `OK` at `info` level.

```
[memory-budget] host=8192MB container=2048MB effective=2048MB worker-rss=72MB
                concurrency=4 task-max-heap=768MB projected-task-heap=3072MB
                headroom=-1096MB (-53%) status=OVERBUDGET
[memory-budget] WARNING: concurrency × task.maxHeapMB exceeds effective memory limit.
                Reduce WORKER_CONCURRENCY or WORKER_TASK_MAX_HEAP_MB, or raise the container limit.
```

Status is computed as:

- `OVERBUDGET` — headroom is negative.
- `TIGHT` — headroom is positive but below `WORKER_TASK_MEMORY_HEADROOM_WARN_PCT`
  percent of the effective limit.
- `OK` — otherwise.

The effective limit is `min(hostTotal, containerLimit)` when the container
limit is known, otherwise `hostTotal`.

The check reads cgroup v2 `/sys/fs/cgroup/memory.max` then falls back to
cgroup v1 `/sys/fs/cgroup/memory/memory.limit_in_bytes`. On macOS / Windows
or when the cgroup file is unreadable / reports `max` / reports a sentinel
"unlimited" value, the container limit shows as `unknown` and the headroom
is computed against host total only.

The behaviour is log-only — the worker does not refuse to start when
overbudget.

## OOM diagnostics

When a task child exits abnormally, the close handler runs
`diagnoseExit(code, signal, stderr, lastMem, ctx)` (see
`worker/src/utils/exit-code.ts`) and writes an English admin diagnostic to
the run log with a category tag:

| Category | Trigger | Meaning |
|---|---|---|
| `success` | exit code 0, no signal | Normal completion (no diagnostic written) |
| `oom-heap` | exit code 134 or signal `SIGABRT` | V8 old-generation heap limit exceeded |
| `oom-host` | signal `SIGKILL` or exit code 137 | Kernel / container OOM-killer (or another forced kill) |
| `plugin-error` | exit code 1 | Plugin threw or `process.exit(1)`'d — stderr is filtered into the message |
| `sigterm` | signal `SIGTERM` or exit code 143 | Graceful kill (user-initiated or shutdown); run marked `killed`, no error log |
| `unknown` | anything else | Unexpected combination of code + signal |

The diagnostic message includes:

- The last memory sample reported by the child via the `df-mem:` stdout
  protocol (heap used vs limit, RSS).
- The number of OTHER concurrent tasks at the moment of failure
  (excludes the task's own slot).
- The configured `WORKER_TASK_MAX_HEAP_MB`.
- A short mitigation hint.

Example `oom-heap` message:

```
Task exceeded the JavaScript heap limit (heap OOM, exit code 134).
Last memory sample — heap used: 24.3MB / 768MB; RSS: 115.0MB.
Concurrent tasks at exit: 0 / concurrency 4.
Configuration: WORKER_TASK_MAX_HEAP_MB=768.
Mitigation: raise WORKER_TASK_MAX_HEAP_MB, lower WORKER_CONCURRENCY,
or inspect the plugin for a memory leak.
```

The exit category is also incremented on the `df_processings_runs_exited_total`
Prometheus counter (see below) — useful for alerting on `oom-heap` or
`oom-host` rates without parsing logs.

**Note on `oom-host` attribution**: a SIGKILL sent by the worker itself
(in `killRun`, after the SIGTERM grace period expires) is currently
indistinguishable from a kernel / container OOM-killer SIGKILL and will be
categorised as `oom-host`. This is a known limitation tracked by a TODO
in `worker/src/worker.ts` near the `diagnoseExit` call. In practice the
run's `killed` status is still recorded separately, so the operator can
cross-check against pending `kill` requests.

## Sampling cadence

`WORKER_TASK_MEMORY_SAMPLE_INTERVAL_MS` controls TWO paths in the child:

1. **Always-on.** Each child writes a `df-mem:<json>` line to its stdout at
   this cadence. The parent worker demuxes these lines, updates the
   Prometheus gauges (see below), and stashes the last sample so it can
   appear in the `oom-heap` / `oom-host` admin message.
2. **Debug-only.** When `processing.debug === true`, the child also writes
   a debug entry to `run.log` at the same cadence using the existing
   `log.debug` plumbing. Useful for diagnosing a specific run without
   enabling cluster-wide debug logging.

The `df-mem:` payload phases are `startup` (emitted once before the plugin
loads), `running` (each interval tick), and `exit` (emitted from a
`process.on('exit', ...)` handler).

The `exit` sample is best-effort: it fires only on graceful Node.js
shutdown. When V8 aborts the process for a heap OOM (`SIGABRT`), the exit
handler does **not** run, and the most recent `running` sample is what
ends up attached to the diagnostic. That is why the sample interval also
governs how stale the heap reading can be at OOM time — set the interval
low enough that operators get a useful "last seen heap" value, but high
enough not to spam the log when `processing.debug` is enabled.

## Metrics

The worker exposes prom-client gauges named to match the Node.js standard
prom-client defaults so off-the-shelf Grafana dashboards work without
bespoke wiring. The labelled per-slot metrics live on the
`servicePromRegistry` from `@data-fair/lib-node/observer.js` and are exposed
at **`GET /service-metrics`** (alias `GET /global-metrics`) on the observer
port (default 9090; the dev worker uses `DEV_WORKER_OBSERVER_PORT`).

| Metric | Type | Labels |
|---|---|---|
| `process_resident_memory_bytes` | gauge | `kind`, `slot` |
| `nodejs_heap_size_total_bytes` | gauge | `kind`, `slot` |
| `nodejs_heap_size_used_bytes` | gauge | `kind`, `slot` |
| `nodejs_external_memory_bytes` | gauge | `kind`, `slot` |
| `df_processings_task_slot_state` | gauge | `slot` (0 idle, 1 running) |
| `df_processings_runs_exited_total` | counter | `category` |

`kind="worker"` represents the parent worker process (no meaningful `slot`).
`kind="task"`, `slot="0".."N-1"` represents each concurrent task slot.

Cardinality is bounded by `WORKER_CONCURRENCY + 1` per gauge.

When a task finishes, its slot's memory gauges retain their last reading
(this is deliberate — the slot reads as "idle, last task ended at X heap"
rather than dropping to zero, which is useful for post-mortem). The slot
state gauge is set to 0 on close, and the next task in the slot overwrites
the memory gauges on its first sample.

`collectDefaultMetrics()` is **not** invoked from `worker/src/utils/metrics.ts`.
The base Node.js process metrics (eventloop lag, GC histograms, default
unlabelled memory gauges, etc.) are installed by
`@data-fair/lib-node/observer.js` on the default `register` and served at
**`GET /metrics`** on the same observer port. The labelled per-slot memory
metrics defined in this feature live on `servicePromRegistry` so they
don't collide with the unlabelled defaults.

In short, on a worker observer port you have two endpoints:

- `GET /metrics` — process defaults (one row per gauge, no `slot` label).
- `GET /service-metrics` — labelled per-slot worker/task gauges plus the
  exit counter and the `df_processings_*` totals.

## V8 flags policy

The worker parent process keeps `--optimize-for-size` (set in the
Dockerfile CMD) — it's an I/O-bound polling loop and benefits from the
smaller V8 baseline.

Task child processes do **NOT** inherit `--optimize-for-size`. They are
spawned with only `--max-old-space-size=<maxHeapMB>` and
`--disable-warning=ExperimentalWarning`. Plugins are often CPU-bound
(parsing, transforming user data), and slowing down their JIT-optimised
paths means slots stay held longer, which keeps concurrent peak heap
pressure higher for longer — the opposite of what the optimisation is for.

This is documented to avoid the policy becoming folklore.

## Forward / open items

- **SIGKILL attribution.** Distinguish "we sent it" (worker's own
  graceful-kill escalation) from "kernel / container OOM-killer sent it" —
  see TODO in `worker/src/worker.ts` near the `diagnoseExit` call. Today
  both cases categorise as `oom-host`.
- **Per-task peak-heap histogram.** Currently we expose per-slot gauges
  but no aggregated peak-heap-on-completion histogram. A histogram would
  let operators size `WORKER_TASK_MAX_HEAP_MB` from real run distributions
  rather than guesswork.
