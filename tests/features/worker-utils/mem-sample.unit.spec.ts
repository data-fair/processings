import { test, expect } from '@playwright/test'
import {
  parseMemSampleLine,
  splitMemSampleLines,
  formatMem,
  type MemorySample
} from '../../../worker/src/utils/mem-sample.ts'

test.describe('parseMemSampleLine', () => {
  test('parses a well-formed df-mem line', () => {
    const line = 'df-mem:{"t":1700000000000,"phase":"running","rss":12345,"heapTotal":2000,"heapUsed":1000,"external":500,"arrayBuffers":100}'
    const out = parseMemSampleLine(line)
    expect(out).toEqual({
      t: 1700000000000,
      phase: 'running',
      rss: 12345,
      heapTotal: 2000,
      heapUsed: 1000,
      external: 500,
      arrayBuffers: 100
    })
  })

  test('returns null for line without df-mem prefix', () => {
    expect(parseMemSampleLine('hello world')).toBeNull()
  })

  test('returns null for malformed JSON after prefix', () => {
    expect(parseMemSampleLine('df-mem:{not json')).toBeNull()
  })

  test('returns null when required fields are missing', () => {
    expect(parseMemSampleLine('df-mem:{"t":1}')).toBeNull()
  })

  test('accepts startup and exit phases', () => {
    const startup = parseMemSampleLine('df-mem:{"t":1,"phase":"startup","rss":1,"heapTotal":1,"heapUsed":1,"external":1,"arrayBuffers":1}')
    const exit = parseMemSampleLine('df-mem:{"t":1,"phase":"exit","rss":1,"heapTotal":1,"heapUsed":1,"external":1,"arrayBuffers":1}')
    expect(startup?.phase).toBe('startup')
    expect(exit?.phase).toBe('exit')
  })

  test('returns null for unknown phase', () => {
    expect(parseMemSampleLine('df-mem:{"t":1,"phase":"weird","rss":1,"heapTotal":1,"heapUsed":1,"external":1,"arrayBuffers":1}')).toBeNull()
  })
})

test.describe('splitMemSampleLines', () => {
  test('separates df-mem lines from other lines', () => {
    const out = splitMemSampleLines(
      'hello\ndf-mem:{"t":1,"phase":"running","rss":1,"heapTotal":1,"heapUsed":1,"external":1,"arrayBuffers":1}\nworld\n',
      ''
    )
    expect(out.samples).toHaveLength(1)
    expect(out.other).toEqual(['hello', 'world'])
    expect(out.residual).toBe('')
  })

  test('returns partial line as residual', () => {
    const out = splitMemSampleLines('hello\npartial', '')
    expect(out.other).toEqual(['hello'])
    expect(out.residual).toBe('partial')
    expect(out.samples).toHaveLength(0)
  })

  test('joins previous residual with new chunk', () => {
    const first = splitMemSampleLines('df-mem:{"t":1,"phase":"running","rss":1,"heap', '')
    expect(first.residual).not.toBe('')
    const second = splitMemSampleLines('Total":1,"heapUsed":1,"external":1,"arrayBuffers":1}\n', first.residual)
    expect(second.samples).toHaveLength(1)
  })

  test('drops malformed df-mem lines silently', () => {
    const out = splitMemSampleLines('df-mem:bad json\nok\n', '')
    expect(out.samples).toHaveLength(0)
    expect(out.other).toEqual(['ok'])
  })
})

test.describe('formatMem', () => {
  test('renders heap/rss in MB with one decimal', () => {
    const sample: MemorySample = {
      t: 0,
      phase: 'running',
      rss: 100 * 1024 * 1024,
      heapTotal: 50 * 1024 * 1024,
      heapUsed: 25 * 1024 * 1024,
      external: 5 * 1024 * 1024,
      arrayBuffers: 1 * 1024 * 1024
    }
    expect(formatMem(sample)).toBe('rss=100.0MB heapTotal=50.0MB heapUsed=25.0MB external=5.0MB arrayBuffers=1.0MB')
  })
})
