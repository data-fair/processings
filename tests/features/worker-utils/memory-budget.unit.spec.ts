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
  warnThresholdPct: 30
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
    expect(r.headroomPct).toBeGreaterThan(30)
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

  test('boundary: headroom exactly at threshold is ok (strict less-than)', () => {
    // Choose inputs so headroomPct == warnThresholdPct exactly.
    // effective=1000, workerRss=0, projected=700 → headroom=300 → 30.0%
    const r = computeBudget({
      hostTotalMB: 1000,
      containerLimitMB: 1000,
      workerProcessRssMB: 0,
      concurrency: 1,
      taskMaxHeapMB: 700,
      warnThresholdPct: 30
    })
    expect(r.headroomPct).toBe(30)
    expect(r.status).toBe('ok')
  })

  test('headroom below threshold is tight', () => {
    // headroom=299 → 29.9%
    const r = computeBudget({
      hostTotalMB: 1000,
      containerLimitMB: 1000,
      workerProcessRssMB: 1,
      concurrency: 1,
      taskMaxHeapMB: 700,
      warnThresholdPct: 30
    })
    expect(r.headroomPct).toBeLessThan(30)
    expect(r.status).toBe('tight')
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
