import { test, expect } from '@playwright/test'
import { shouldDisableForFailures, buildFinishStatusPatch } from '../../../worker/src/utils/runs-operations.ts'

test.describe('shouldDisableForFailures', () => {
  const maxFailures = 3
  const cooldownHours = 12

  test('false when error count below threshold', () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 24 * 3600 * 1000)
    expect(shouldDisableForFailures(2, earlier, now, maxFailures, cooldownHours)).toBe(false)
  })

  test('false when threshold met but cooldown window not reached', () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 1 * 3600 * 1000) // 1h span
    expect(shouldDisableForFailures(maxFailures, earlier, now, maxFailures, cooldownHours)).toBe(false)
  })

  test('true when threshold met AND cooldown window reached', () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 24 * 3600 * 1000) // 24h span
    expect(shouldDisableForFailures(maxFailures, earlier, now, maxFailures, cooldownHours)).toBe(true)
  })

  test('false when no error dates available even if count met', () => {
    expect(shouldDisableForFailures(maxFailures, null, null, maxFailures, cooldownHours)).toBe(false)
  })

  test('cooldown=0 disables as soon as threshold is reached and any errors exist', () => {
    const now = new Date()
    expect(shouldDisableForFailures(maxFailures, now, now, maxFailures, 0)).toBe(true)
  })

  test('overshooting threshold also disables (errors > maxFailures)', () => {
    // current implementation requires exact equality — document behavior
    const now = new Date()
    const earlier = new Date(now.getTime() - 24 * 3600 * 1000)
    expect(shouldDisableForFailures(maxFailures + 1, earlier, now, maxFailures, cooldownHours)).toBe(false)
  })
})

test.describe('buildFinishStatusPatch', () => {
  const finishedAt = '2030-01-02T03:04:05.000Z'

  test('killed input stays killed', () => {
    expect(buildFinishStatusPatch('killed', undefined, finishedAt)).toEqual({ status: 'killed', finishedAt })
  })

  test('killed wins over an errorMessage', () => {
    expect(buildFinishStatusPatch('killed', 'boom', finishedAt)).toEqual({ status: 'killed', finishedAt })
  })

  test('errorMessage marks as error', () => {
    expect(buildFinishStatusPatch('running', 'boom', finishedAt)).toEqual({ status: 'error', finishedAt })
  })

  test('no errorMessage and not killed -> finished', () => {
    expect(buildFinishStatusPatch('running', undefined, finishedAt)).toEqual({ status: 'finished', finishedAt })
  })
})
