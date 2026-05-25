import { test, expect } from '@playwright/test'
import { buildErrorMessageFromStderr, formatMemoryUsage, exitCodeHint } from '../../../worker/src/utils/worker-operations.ts'

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

test.describe('formatMemoryUsage', () => {
  test('renders all components rounded to MB', () => {
    const mb = 1024 * 1024
    expect(formatMemoryUsage({
      rss: 256 * mb,
      heapUsed: 128 * mb,
      heapTotal: 200 * mb,
      external: 16 * mb,
      arrayBuffers: 0
    })).toBe('rss=256MB heap=128/200MB ext=16MB')
  })

  test('returns a string when called without arguments', () => {
    expect(typeof formatMemoryUsage()).toBe('string')
  })
})

test.describe('exitCodeHint', () => {
  test('returns a V8/SIGABRT hint for code 134', () => {
    expect(exitCodeHint(134)).toContain('SIGABRT')
    expect(exitCodeHint(134)).toContain('NODE_OPTIONS')
  })

  test('returns an OOM-kill hint for code 137', () => {
    expect(exitCodeHint(137)).toContain('SIGKILL')
    expect(exitCodeHint(137)).toContain('mem_limit')
  })

  test('returns empty string for unrelated codes', () => {
    expect(exitCodeHint(1)).toBe('')
    expect(exitCodeHint(143)).toBe('')
    expect(exitCodeHint(null)).toBe('')
    expect(exitCodeHint(undefined)).toBe('')
  })
})
