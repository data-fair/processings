import { test, expect } from '@playwright/test'
import type { Scheduling } from '#api/types'
import { toCRON, nextScheduledDate } from '../../../shared/runs.ts'

test.describe('shared/runs toCRON', () => {
  test('formats a daily schedule', () => {
    const s = { type: 'daily', month: '*', dayOfMonth: '*', dayOfWeek: '*', hour: 7, minute: 30 } as unknown as Scheduling
    expect(toCRON(s)).toBe('30 7 * * *')
  })

  test('formats a weekly schedule', () => {
    const s = { type: 'weekly', month: '*', dayOfMonth: '*', dayOfWeek: '1', hour: 9, minute: 0 } as unknown as Scheduling
    expect(toCRON(s)).toBe('0 9 * * 1')
  })

  test('formats a monthly schedule with fixed day', () => {
    const s = { type: 'monthly', month: '*', dayOfMonth: 15, dayOfWeek: '*', hour: 6, minute: 0, lastDayOfMonth: false } as unknown as Scheduling
    expect(toCRON(s)).toBe('0 6 15 * *')
  })

  test('formats a monthly schedule with lastDayOfMonth', () => {
    const s = { type: 'monthly', month: '*', dayOfMonth: 1, dayOfWeek: '*', hour: 6, minute: 0, lastDayOfMonth: true } as unknown as Scheduling
    expect(toCRON(s)).toBe('0 6 L * *')
  })

  test('applies hour step', () => {
    const s = { type: 'hours', month: '*', dayOfMonth: '*', dayOfWeek: '*', hour: '*', hourStep: 3, minute: 15 } as unknown as Scheduling
    expect(toCRON(s)).toBe('15 */3 * * *')
  })

  test('applies minute step', () => {
    const s = { type: 'hours', month: '*', dayOfMonth: '*', dayOfWeek: '*', hour: '*', minute: 0, minuteStep: 10 } as unknown as Scheduling
    expect(toCRON(s)).toBe('0/10 * * * *')
  })
})

test.describe('shared/runs nextScheduledDate', () => {
  test('returns null for an empty schedule list', () => {
    expect(nextScheduledDate([])).toBeNull()
  })

  test('returns the next fire date in the future', () => {
    const s = { type: 'daily', month: '*', dayOfMonth: '*', dayOfWeek: '*', hour: 0, minute: 0, timeZone: 'UTC' } as unknown as Scheduling
    const next = nextScheduledDate([s])
    expect(next).toBeInstanceOf(Date)
    expect(next!.getTime()).toBeGreaterThan(Date.now())
  })

  test('picks the earliest among multiple schedulings', () => {
    const daily = { type: 'daily', month: '*', dayOfMonth: '*', dayOfWeek: '*', hour: 0, minute: 0, timeZone: 'UTC' } as unknown as Scheduling
    const hourly = { type: 'hours', month: '*', dayOfMonth: '*', dayOfWeek: '*', hour: '*', hourStep: 1, minute: 0, timeZone: 'UTC' } as unknown as Scheduling
    const next = nextScheduledDate([daily, hourly])!
    // hourly should be sooner than next-midnight in almost every case (only equal at exact midnight)
    const hourlyOnly = nextScheduledDate([hourly])!
    expect(next.getTime()).toBe(hourlyOnly.getTime())
  })

  test('throws when a scheduling rule cannot produce a next date', () => {
    // an obviously impossible cron: dayOfMonth=31 with month=2 (February) — croner returns null
    const s = { type: 'monthly', month: '2', dayOfMonth: 31, dayOfWeek: '*', hour: 0, minute: 0, lastDayOfMonth: false, timeZone: 'UTC' } as unknown as Scheduling
    expect(() => nextScheduledDate([s])).toThrow()
  })
})
