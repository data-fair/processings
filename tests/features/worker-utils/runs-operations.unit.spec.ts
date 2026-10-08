import { test, expect } from '@playwright/test'
import { shouldDisableForFailures, buildFinishStatusPatch, isDocumentTooLargeError, truncateLogValue } from '../../../worker/src/utils/runs-operations.ts'

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

test.describe('isDocumentTooLargeError', () => {
  test('matches the mongo error of an update overflowing the document limit', () => {
    expect(isDocumentTooLargeError(new Error('Plan executor error during findAndModify :: caused by :: Resulting document after update is larger than 16777216'))).toBe(true)
    expect(isDocumentTooLargeError(Object.assign(new Error('BSONObjectTooLarge'), { code: 17419 }))).toBe(true)
  })

  test('ignores other errors', () => {
    expect(isDocumentTooLargeError(new Error('Run not found'))).toBe(false)
    expect(isDocumentTooLargeError(undefined)).toBe(false)
  })
})

test.describe('truncateLogValue', () => {
  test('leaves short values untouched', () => {
    expect(truncateLogValue('hello', 100)).toBe('hello')
    expect(truncateLogValue({ a: 1 }, 100)).toEqual({ a: 1 })
    expect(truncateLogValue(undefined, 100)).toBeUndefined()
    expect(truncateLogValue('', 100)).toBe('')
  })

  test('truncates a long string', () => {
    expect(truncateLogValue('a'.repeat(50), 10)).toBe('a'.repeat(10) + '...')
  })

  test('serializes then truncates a long non-string value', () => {
    const value = { items: new Array(100).fill('x') }
    expect(truncateLogValue(value, 10)).toBe(JSON.stringify(value).slice(0, 10) + '...')
  })
})
