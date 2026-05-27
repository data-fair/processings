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
