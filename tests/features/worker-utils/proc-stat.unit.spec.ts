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

  test('returns null when stat line has too few fields after closing paren', () => {
    expect(parseStatFields('1234 (node) S 5678')).toBeNull()
  })
})
