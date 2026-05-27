// Test fixture: deliberately exhaust the V8 old-generation heap by growing
// arrays of native JS values. We must avoid Buffer / ArrayBuffer allocations:
// those go into Node's "external" memory pool, which V8's
// --max-old-space-size does not constrain — the process would just keep
// growing RSS indefinitely instead of aborting with "JavaScript heap out of
// memory" (exit code 134).
//
// Strategy: push 1M-element arrays of small unique objects into a global
// sink. Each object is ~80-120 bytes in V8's heap representation, so each
// inner array contributes ~80-120 MB of old-space. With the default
// WORKER_TASK_MAX_HEAP_MB=768 we hit the limit within a few iterations.
export const run = async (context) => {
  const { log } = context
  await log.step('starting oom-leak fixture')
  const sink = []
  for (let i = 0; i < 1000; i++) {
    const chunk = new Array(1_000_000)
    for (let j = 0; j < chunk.length; j++) {
      // Unique object so V8 can't intern / GC-coalesce; payload string ensures
      // the object isn't an empty shell.
      chunk[j] = { i, j, s: 'leak-' + i + '-' + j }
    }
    sink.push(chunk)
    // Yield so the worker can deliver SIGTERM during the grace period if
    // needed; this also gives V8 a microtask boundary to schedule GC and
    // ultimately fail the allocation.
    await new Promise(resolve => setImmediate(resolve))
  }
}
