import { test, expect } from '@playwright/test'
import { buildErrorMessageFromStderr } from '../../../worker/src/utils/worker-operations.ts'

test.describe('buildErrorMessageFromStderr', () => {
  test('falls back to errMessage when stderr is empty', () => {
    expect(buildErrorMessageFromStderr('', 'fallback boom')).toBe('fallback boom')
  })

  test('drops debug lines starting with "worker:" and TLS env-var noise', () => {
    const stderr = [
      'worker:loop something happened',
      'NODE_TLS_REJECT_UNAUTHORIZED is set, ignore',
      'real error: connection refused',
      ''
    ].join('\n')
    expect(buildErrorMessageFromStderr(stderr, 'fallback')).toBe('real error: connection refused')
  })

  test('preserves order of relevant lines', () => {
    const stderr = 'first line\nsecond line\nthird line'
    expect(buildErrorMessageFromStderr(stderr, 'unused')).toBe('first line\nsecond line\nthird line')
  })

  test('falls back to errMessage when every line is filtered out', () => {
    const stderr = 'worker:foo\nworker:bar\n'
    expect(buildErrorMessageFromStderr(stderr, 'fallback')).toBe('fallback')
  })

  test('skips empty lines but keeps the surrounding ones', () => {
    expect(buildErrorMessageFromStderr('a\n\nb\n', 'fb')).toBe('a\nb')
  })
})
