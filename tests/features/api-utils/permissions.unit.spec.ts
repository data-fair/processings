import { test, expect } from '@playwright/test'
import type { SessionStateAuthenticated, Account } from '@data-fair/lib-express'
import permissions from '../../../api/src/misc/utils/permissions.ts'

const ownerUser: Account = { type: 'user', id: 'u1', name: 'U1' }
const ownerOrg: Account = { type: 'organization', id: 'org1', name: 'Org1' }
const ownerOrgWithDept: Account = { type: 'organization', id: 'org1', name: 'Org1', department: 'd1' }

const session = (overrides: any = {}): SessionStateAuthenticated => ({
  user: { id: 'u1', name: 'U1', email: 'u1@test.com', adminMode: false, organizations: [] },
  account: { type: 'user', id: 'u1', name: 'U1' },
  accountRole: 'admin',
  ...overrides
}) as unknown as SessionStateAuthenticated

test.describe('getOwnerRole', () => {
  test('returns admin when user owns the resource', () => {
    expect(permissions.getOwnerRole(session(), ownerUser)).toBe('admin')
  })

  test('returns null when account type/id mismatches', () => {
    const s = session({ account: { type: 'user', id: 'u2', name: 'U2' } })
    expect(permissions.getOwnerRole(s, ownerUser)).toBeNull()
  })

  test('returns accountRole for matching organization', () => {
    const s = session({ account: { type: 'organization', id: 'org1', name: 'Org1' }, accountRole: 'contrib' })
    expect(permissions.getOwnerRole(s, ownerOrg)).toBe('contrib')
  })

  test('null when org session has different department than owner', () => {
    const s = session({ account: { type: 'organization', id: 'org1', name: 'Org1', department: 'd2' }, accountRole: 'admin' })
    expect(permissions.getOwnerRole(s, ownerOrgWithDept)).toBeNull()
  })
})

test.describe('isAdmin / isContrib / isMember', () => {
  test('admin via ownership', () => {
    expect(permissions.isAdmin(session(), ownerUser)).toBe(true)
  })

  test('admin via adminMode regardless of ownership', () => {
    const s = session({ user: { id: 'u9', adminMode: true, email: 'su@x', organizations: [] }, account: { type: 'user', id: 'u9' } })
    expect(permissions.isAdmin(s, ownerUser)).toBe(true)
  })

  test('isContrib true for contrib role', () => {
    const s = session({ account: { type: 'organization', id: 'org1' }, accountRole: 'contrib' })
    expect(permissions.isContrib(s, ownerOrg)).toBe(true)
    expect(permissions.isAdmin(s, ownerOrg)).toBe(false)
  })

  test('isMember true for any role on owner', () => {
    const s = session({ account: { type: 'organization', id: 'org1' }, accountRole: 'user' })
    expect(permissions.isMember(s, ownerOrg)).toBe(true)
    expect(permissions.isContrib(s, ownerOrg)).toBe(false)
  })

  test('non-member returns false on all', () => {
    const s = session({ account: { type: 'user', id: 'u2' } })
    expect(permissions.isAdmin(s, ownerUser)).toBe(false)
    expect(permissions.isContrib(s, ownerUser)).toBe(false)
    expect(permissions.isMember(s, ownerUser)).toBe(false)
  })
})

test.describe('getUserResourceProfile', () => {
  test('admin owner -> admin', () => {
    expect(permissions.getUserResourceProfile(ownerUser, [], session())).toBe('admin')
  })

  test('adminMode -> admin', () => {
    const s = session({ user: { id: 'u9', adminMode: true, email: 'su@x', organizations: [] }, account: { type: 'user', id: 'u9' } })
    expect(permissions.getUserResourceProfile(ownerUser, [], s)).toBe('admin')
  })

  test('contrib org member -> read (no permission match)', () => {
    const s = session({ account: { type: 'organization', id: 'org1' }, accountRole: 'contrib' })
    expect(permissions.getUserResourceProfile(ownerOrg, [], s)).toBe('read')
  })

  test('non-member matches userEmail permission -> exec', () => {
    const s = session({ account: { type: 'user', id: 'u2' }, user: { id: 'u2', email: 'u2@test.com', adminMode: false, organizations: [] } })
    const perms = [{ profile: 'exec', target: { type: 'userEmail', email: 'u2@test.com' } }] as any
    expect(permissions.getUserResourceProfile(ownerUser, perms, s)).toBe('exec')
  })

  test('non-member with no matching permission -> undefined', () => {
    const s = session({ account: { type: 'user', id: 'u2' }, user: { id: 'u2', email: 'u2@test.com', adminMode: false, organizations: [] } })
    expect(permissions.getUserResourceProfile(ownerUser, [], s)).toBeUndefined()
  })

  test('partner permission grants read to org session', () => {
    const s = session({ account: { type: 'organization', id: 'partner-org' }, accountRole: 'admin', user: { id: 'u3', email: 'u3@test.com', adminMode: false, organizations: [{ id: 'partner-org', role: 'admin' }] } })
    const perms = [{ profile: 'read', target: { type: 'partner', organization: { id: 'partner-org' }, roles: ['admin'] } }] as any
    expect(permissions.getUserResourceProfile(ownerUser, perms, s)).toBe('read')
  })

  test('read profile beats no-match even when both exec/read present', () => {
    const s = session({ account: { type: 'user', id: 'u2' }, user: { id: 'u2', email: 'u2@test.com', adminMode: false, organizations: [] } })
    const perms = [
      { profile: 'read', target: { type: 'userEmail', email: 'u2@test.com' } },
      { profile: 'exec', target: { type: 'userEmail', email: 'other@test.com' } }
    ] as any
    expect(permissions.getUserResourceProfile(ownerUser, perms, s)).toBe('read')
  })
})

test.describe('getOwnerPermissionFilter', () => {
  test('admin gets unfiltered owner match', () => {
    const filter = permissions.getOwnerPermissionFilter(session(), ownerUser)
    expect(filter).toEqual({ 'owner.type': 'user', 'owner.id': 'u1' })
    expect((filter as any).permissions).toBeUndefined()
  })

  test('owner department included when set', () => {
    const filter = permissions.getOwnerPermissionFilter(
      session({ account: { type: 'organization', id: 'org1', department: 'd1' }, accountRole: 'admin' }),
      ownerOrgWithDept
    )
    expect(filter).toMatchObject({ 'owner.type': 'organization', 'owner.id': 'org1', 'owner.department': 'd1' })
  })

  test('non-member adds permissions $elemMatch with userEmail target', () => {
    const s = session({ account: { type: 'user', id: 'u2' }, user: { id: 'u2', email: 'u2@test.com', adminMode: false, organizations: [] } })
    const filter = permissions.getOwnerPermissionFilter(s, ownerUser) as any
    expect(filter.permissions.$elemMatch.profile).toEqual({ $in: ['read', 'exec'] })
    expect(filter.permissions.$elemMatch.$or).toContainEqual({ 'target.type': 'userEmail', 'target.email': 'u2@test.com' })
  })

  test('partner branch added when session account is org', () => {
    const s = session({ account: { type: 'organization', id: 'partner-org' }, accountRole: 'admin', user: { id: 'u2', email: 'u2@test.com', adminMode: false, organizations: [{ id: 'partner-org', role: 'admin' }] } })
    const filter = permissions.getOwnerPermissionFilter(s, ownerUser) as any
    expect(filter.permissions.$elemMatch.$or).toContainEqual({
      'target.type': 'partner',
      'target.organization.id': 'partner-org',
      'target.roles': 'admin'
    })
  })
})

test.describe('emailless principal (nhi / api key) guardrails', () => {
  // an absent email must never produce an unconstrained { 'target.type': 'userEmail' } branch:
  // the mongo driver (ignoreUndefined) would drop the undefined email and match every
  // email-targeted permission.
  test('emailless personal-account session emits no userEmail branch and a non-empty $or', () => {
    const s = session({ account: { type: 'user', id: 'u2' }, user: { id: 'u2', adminMode: false, organizations: [] } })
    const filter = permissions.getOwnerPermissionFilter(s, ownerUser) as any
    const or = filter.permissions.$elemMatch.$or
    expect(or.length).toBeGreaterThan(0) // mongo rejects an empty $or
    for (const branch of or) expect(branch['target.type']).not.toBe('userEmail')
  })

  test('emailless org session keeps only the partner branch', () => {
    const s = session({ account: { type: 'organization', id: 'org1' }, accountRole: 'user', user: { id: 'svc1', nhi: 1, adminMode: false, organizations: [{ id: 'org1', role: 'user' }] } })
    const filter = permissions.getOwnerPermissionFilter(s, ownerOrg) as any
    const types = filter.permissions.$elemMatch.$or.map((b: any) => b['target.type'])
    expect(types).not.toContain('userEmail')
    expect(types).toContain('partner')
  })

  test('emailless session does not match a userEmail permission whose email is absent', () => {
    const s = session({ account: { type: 'user', id: 'u2' }, user: { id: 'u2', adminMode: false, organizations: [] } })
    const perms = [{ profile: 'exec', target: { type: 'userEmail' } }] as any
    expect(permissions.getUserResourceProfile(ownerUser, perms, s)).toBeUndefined()
  })
})
