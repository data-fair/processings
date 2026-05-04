import { test, expect } from '@playwright/test'
import { calculateRemainingLimit } from '../../../worker/src/utils/limits-operations.ts'

test.describe('calculateRemainingLimit', () => {
  test('returns 0 when limits object is null', () => {
    expect(calculateRemainingLimit(null, 'processings_seconds')).toBe(0)
  })

  test('returns 0 when key absent from limits object', () => {
    expect(calculateRemainingLimit({}, 'processings_seconds')).toBe(0)
  })

  test('returns -1 (unlimited) when limit is -1', () => {
    expect(calculateRemainingLimit({ processings_seconds: { limit: -1, consumption: 999 } }, 'processings_seconds')).toBe(-1)
  })

  test('returns limit - consumption when below quota', () => {
    expect(calculateRemainingLimit({ processings_seconds: { limit: 100, consumption: 30 } }, 'processings_seconds')).toBe(70)
  })

  test('clamps to 0 when consumption exceeds limit', () => {
    expect(calculateRemainingLimit({ processings_seconds: { limit: 100, consumption: 250 } }, 'processings_seconds')).toBe(0)
  })

  test('treats missing consumption as 0', () => {
    expect(calculateRemainingLimit({ processings_seconds: { limit: 50 } }, 'processings_seconds')).toBe(50)
  })
})
