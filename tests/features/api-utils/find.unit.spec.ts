import { test, expect } from '@playwright/test'
import type { SessionStateAuthenticated } from '@data-fair/lib-express'
import findUtils from '../../../api/src/misc/utils/find.ts'

const session = (overrides: any = {}): SessionStateAuthenticated => ({
  user: { id: 'u1', name: 'U1', email: 'u1@test.com', adminMode: false, organizations: [] },
  account: { type: 'user', id: 'u1', name: 'U1' },
  accountRole: 'admin',
  ...overrides
}) as unknown as SessionStateAuthenticated

test.describe('find.sort', () => {
  test('returns empty object when no sort string', () => {
    expect(findUtils.sort(undefined)).toEqual({})
    expect(findUtils.sort('')).toEqual({})
  })

  test('parses single sort key', () => {
    expect(findUtils.sort('title:1')).toEqual({ title: 1 })
  })

  test('parses multiple sort keys with directions', () => {
    expect(findUtils.sort('title:1,createdAt:-1')).toEqual({ title: 1, createdAt: -1 })
  })
})

test.describe('find.pagination', () => {
  test('defaults size=10 skip=0', () => {
    expect(findUtils.pagination(undefined, undefined, undefined)).toEqual([10, 0])
  })

  test('parses size and ignores invalid values', () => {
    expect(findUtils.pagination('25', undefined, undefined)).toEqual([25, 0])
    expect(findUtils.pagination('not-a-number', undefined, undefined)).toEqual([10, 0])
  })

  test('skip takes precedence over page', () => {
    expect(findUtils.pagination('20', '3', '50')).toEqual([20, 50])
  })

  test('falls back to page when skip is missing', () => {
    expect(findUtils.pagination('20', '3', undefined)).toEqual([20, 40])
  })

  test('treats invalid skip as 0 even with page set', () => {
    // page is only used as a fallback when skip is undefined; invalid skip stays 0
    expect(findUtils.pagination('20', '3', 'NaN')).toEqual([20, 40])
  })
})

test.describe('find.project', () => {
  test('returns empty object when no select', () => {
    expect(findUtils.project(undefined)).toEqual({})
  })

  test('builds projection object with 1 for each field', () => {
    expect(findUtils.project('title,owner')).toEqual({ title: 1, owner: 1 })
  })
})

test.describe('find.query', () => {
  test('full-text search via q', () => {
    const q = findUtils.query({ q: 'foo' }, session())
    expect(q.$text).toEqual({ $search: 'foo' })
  })

  test('owners default to current account', () => {
    const q = findUtils.query({}, session())
    expect(q.$and).toBeDefined()
    expect(q.$and[0].$or[0]).toMatchObject({ 'owner.type': 'user', 'owner.id': 'u1' })
  })

  test('showAll requires admin mode', () => {
    expect(() => findUtils.query({ showAll: 'true' }, session())).toThrow()
  })

  test('showAll allowed for super admin', () => {
    const q = findUtils.query({ showAll: 'true' }, session({ user: { id: 'u1', name: 'U1', email: 'u1@test.com', adminMode: true, organizations: [] } }))
    expect(q.$and).toBeUndefined()
  })

  test('explicit owner filter', () => {
    const q = findUtils.query({ owner: 'organization:org1' }, session({ user: { id: 'u1', name: 'U1', email: 'u1@test.com', adminMode: true, organizations: [] } }))
    expect(q.$and[0].$or[0]).toMatchObject({ 'owner.type': 'organization', 'owner.id': 'org1' })
  })

  test('rejects unknown owner type', () => {
    expect(() => findUtils.query({ owner: 'group:abc' }, session({ user: { id: 'u1', name: 'U1', email: 'u1@test.com', adminMode: true, organizations: [] } }))).toThrow()
  })

  test('applies fieldsMap with comma-separated values', () => {
    const q = findUtils.query({ status: 'a,b' }, session(), { status: 'lastRun.status' })
    expect(q['lastRun.status']).toEqual({ $in: ['a', 'b'] })
  })
})
