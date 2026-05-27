import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { anonymousAx, axiosAuth, clean, waitForRunStatus } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

const buildOomLeakTarball = (): string => {
  const fixtureDir = path.resolve(import.meta.dirname, '../../fixtures/processing-oom-leak')
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oom-leak-pack-'))
  execSync('npm pack --pack-destination ' + outDir, { cwd: fixtureDir, stdio: 'pipe' })
  const tarball = fs.readdirSync(outDir).find(f => f.endsWith('.tgz'))
  if (!tarball) throw new Error('npm pack did not produce a tarball')
  return path.join(outDir, tarball)
}

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

// Dev worker exposes its prom-client registry on DEV_WORKER_OBSERVER_PORT
// (see worker/config/development.mjs). Fall back to the production default
// 9090 just in case a non-dev environment ever runs this spec.
const metricsPort = process.env.DEV_WORKER_OBSERVER_PORT ?? process.env.OBSERVER_PORT ?? '9090'
const metricsUrl = `http://localhost:${metricsPort}/metrics`

const extractOomHeapCount = (metrics: string): number => {
  // Match df_processings_runs_exited_total{...category="oom-heap"...} <value>
  const m = metrics.match(/^df_processings_runs_exited_total\{[^}]*category="oom-heap"[^}]*\}\s+(\d+(?:\.\d+)?)/m)
  return m ? Number(m[1]) : 0
}

test.describe('memory pressure diagnostics', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('task that exhausts V8 heap produces oom-heap diagnostic', async () => {
    test.setTimeout(120_000)

    const superadmin = await axiosAuth('test_superadmin@test.com')

    // Capture the baseline counter so we can assert it increments.
    let baselineExits = 0
    let metricsReachable = false
    try {
      const baselineMetrics = (await anonymousAx.get(metricsUrl)).data as string
      baselineExits = extractOomHeapCount(baselineMetrics)
      metricsReachable = true
    } catch {
      // Metrics endpoint not reachable — fall back to asserting only on the
      // run log. This shouldn't happen in the dev/test env but we don't want
      // the test to be flaky if the observer is temporarily down.
    }

    const tarballPath = buildOomLeakTarball()
    const plugin = await publishFixturePlugin({
      name: '@data-fair-tests/processing-oom-leak',
      version: '1.0.0',
      tarballPath
    })

    const processing = (await superadmin.post('/api/v1/processings', {
      title: 'OOM leak test',
      plugin: plugin.pluginId,
      owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' },
      active: true,
      config: {}
    })).data

    const triggered = (await superadmin.post(`/api/v1/processings/${processing._id}/_trigger`)).data

    // The leak exhausts ~768 MB in a few seconds; give it generous slack
    // (V8 heap budget can take 10-20s to fragment depending on GC pressure).
    const finalRun = await waitForRunStatus(triggered._id, 'error', 90_000)
    expect(finalRun.status).toBe('error')

    // The run log carries the French user-facing OOM message. The English
    // diagnostic ("heap OOM", "exit code 134") goes to the worker's stdout
    // (ops), not the run log. Match on the French wording emitted by
    // oomHeapUser() in worker/src/utils/exit-code.ts.
    const allMsgs = (finalRun.log ?? []).map((l: any) => l.msg).join('\n')
    expect(allMsgs).toMatch(/limite de mémoire|tas JavaScript/i)

    // Prometheus counter incremented (best-effort; skip if endpoint unreachable
    // at baseline time).
    if (metricsReachable) {
      const metrics = (await anonymousAx.get(metricsUrl)).data as string
      const currentCount = extractOomHeapCount(metrics)
      expect(currentCount).toBeGreaterThan(baselineExits)
    }
  })

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
        observedExternal = true
        break
      }
    }
    expect(observedExternal, `no slot showed external-sampler activity:${observationDetails}`).toBe(true)
  })
})
