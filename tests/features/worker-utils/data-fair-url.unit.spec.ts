import { test, expect } from '@playwright/test'
import { resolveDataFairUrl } from '../../../worker/src/task/data-fair-url.ts'

test.describe('resolveDataFairUrl', () => {
  const dataFairUrl = 'https://df.example.com/data-fair'

  test('matches URLs inside the data-fair base path', () => {
    expect(resolveDataFairUrl('https://df.example.com/data-fair', dataFairUrl)).toBe('https://df.example.com/data-fair')
    expect(resolveDataFairUrl('https://df.example.com/data-fair/api/v1/datasets?q=a', dataFairUrl)).toBe('https://df.example.com/data-fair/api/v1/datasets?q=a')
  })

  test('rejects lookalike URLs that a string prefix would accept', () => {
    const rootDataFairUrl = 'https://df.example.com'
    expect(resolveDataFairUrl('https://df.example.com.evil.com/api/v1/datasets', rootDataFairUrl)).toBeUndefined()
    expect(resolveDataFairUrl('https://df.example.com@evil.com/api/v1/datasets', rootDataFairUrl)).toBeUndefined()
    expect(resolveDataFairUrl('https://df.example.com:8443/api/v1/datasets', rootDataFairUrl)).toBeUndefined()
    expect(resolveDataFairUrl('https://df.example.com/data-fair-other/api', dataFairUrl)).toBeUndefined()
    expect(resolveDataFairUrl('https://df.example.com/data-fair/../other', dataFairUrl)).toBeUndefined()
    expect(resolveDataFairUrl('http://df.example.com/data-fair/api', dataFairUrl)).toBeUndefined()
    expect(resolveDataFairUrl('https://df.example.com/data-fair@evil.example/x', dataFairUrl)).toBeUndefined()
  })

  test('never lets a path inject an authority in the private URL', () => {
    // a string replace of the public base by the private one would give http://data-fair:8080@evil.example/x
    expect(resolveDataFairUrl('https://df.example.com/@evil.example/x', 'https://df.example.com', 'http://data-fair:8080'))
      .toBe('http://data-fair:8080/@evil.example/x')
    expect(new URL(resolveDataFairUrl('https://df.example.com/data-fair/@169.254.169.254/latest', dataFairUrl, 'http://data-fair:8080') as string).host)
      .toBe('data-fair:8080')
  })

  test('matches every path of a data-fair served at the root of its domain', () => {
    expect(resolveDataFairUrl('https://df.example.com/api/v1/datasets', 'https://df.example.com/')).toBe('https://df.example.com/api/v1/datasets')
  })

  test('rewrites to the private data-fair URL', () => {
    expect(resolveDataFairUrl('https://df.example.com/data-fair/api/v1/datasets?q=a', dataFairUrl, 'http://data-fair:8080'))
      .toBe('http://data-fair:8080/api/v1/datasets?q=a')
    expect(resolveDataFairUrl('https://df.example.com/data-fair/api', dataFairUrl, 'http://data-fair:8080/data-fair/'))
      .toBe('http://data-fair:8080/data-fair/api')
    expect(resolveDataFairUrl('https://other.com/data-fair/api', dataFairUrl, 'http://data-fair:8080')).toBeUndefined()
  })
})
