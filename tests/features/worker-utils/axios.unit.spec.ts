import { test, expect } from '@playwright/test'
import { prepareAxiosError, getHttpErrorMessage } from '../../../worker/src/task/axios-errors.ts'

test.describe('prepareAxiosError', () => {
  test('returns the error unchanged when there is no response', () => {
    const err = new Error('boom')
    expect(prepareAxiosError(err)).toBe(err)
  })

  test('shapes a response: keeps location header, drops everything else', () => {
    const err: any = {
      message: 'failed',
      stack: 'stack-trace',
      config: { method: 'POST', url: '/x', params: { a: 1 }, data: { b: 2 }, otherSecret: 's' },
      response: {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'application/json', location: '/redir' },
        data: { hello: 'world' },
        request: 'should be removed'
      }
    }
    const out = prepareAxiosError(err)
    expect(out.status).toBe(502)
    expect(out.headers).toEqual({ location: '/redir' })
    expect(out.request).toBeUndefined()
    expect(out.config).toEqual({ method: 'POST', url: '/x', params: { a: 1 }, data: { b: 2 } })
    expect(out.message).toBe('failed')
    expect(out.stack).toBe('stack-trace')
  })

  test('drops streaming request data and response body', () => {
    const err: any = {
      message: 'm',
      response: {
        status: 500,
        headers: {},
        data: { _readableState: {}, foo: 1 },
        config: { method: 'PUT', url: '/u', data: { _writableState: {}, x: 1 } }
      }
    }
    const out = prepareAxiosError(err)
    expect(out.data).toBeUndefined()
    expect(out.config.data).toBeUndefined()
  })

  test('falls back to error.request.res when no response set', () => {
    const inner = { status: 503, headers: {}, config: { method: 'GET', url: '/x' } }
    const err: any = { message: 'm', request: { res: inner } }
    const out = prepareAxiosError(err)
    expect(out).toBe(inner)
    expect(out.status).toBe(503)
    expect(out.message).toBe('m')
  })
})

test.describe('getHttpErrorMessage', () => {
  test('returns undefined when no http status is present', () => {
    expect(getHttpErrorMessage({ message: 'oops' })).toBeUndefined()
  })

  test('combines status, statusText and string data', () => {
    expect(getHttpErrorMessage({ status: 404, statusText: 'Not Found', data: 'missing' }))
      .toBe('404 - Not Found - missing')
  })

  test('falls back to statusCode/statusMessage', () => {
    expect(getHttpErrorMessage({ statusCode: 500, statusMessage: 'KO' })).toBe('500 - KO')
  })

  test('JSON-stringifies object data', () => {
    expect(getHttpErrorMessage({ status: 400, data: { error: 'x' } })).toBe('400 - {"error":"x"}')
  })

  test('appends url from config when present', () => {
    const out = getHttpErrorMessage({ status: 404, config: { url: 'https://elsewhere/path' } })
    expect(out).toContain('(https://elsewhere/path)')
  })

  test('strips known base urls from displayed url', () => {
    const out = getHttpErrorMessage(
      { status: 404, config: { url: 'http://df.local/api/v1/datasets' } },
      ['http://df.local', null, 'http://internal.df']
    )
    expect(out).toContain('(/api/v1/datasets)')
  })

  test('falls back to err.message when no data', () => {
    expect(getHttpErrorMessage({ status: 502, message: 'upstream broken' }))
      .toBe('502 - upstream broken')
  })
})
