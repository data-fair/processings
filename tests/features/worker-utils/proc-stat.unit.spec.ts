import { test, expect } from '@playwright/test'
import {
  parseStatusVmRss,
  parseStatFields,
  readProcStat,
  computeCpuRatio,
  isSupported,
  CLOCK_TICKS_PER_SEC
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

  test('returns null when stat line has too few fields after closing paren', () => {
    expect(parseStatFields('1234 (node) S 5678')).toBeNull()
  })
})

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
