import type { SessionStateAuthenticated, Account } from '@data-fair/lib-express'
import type { NextFunction, Request, Response } from 'express'
import type { AccountKeys, Permission } from '#types'

import { session } from '@data-fair/lib-express/index.js'

const getOwnerRole = (sessionState: SessionStateAuthenticated, owner: AccountKeys) => {
  if (!sessionState) return null
  if (sessionState.account.type !== owner.type || sessionState.account.id !== owner.id) return null
  if (sessionState.account.type === 'user') return 'admin'
  if (sessionState.account.department && sessionState.account.department !== owner.department) return null
  return sessionState.accountRole
}

/**
 * Middleware to check if the user is a super admin
 */
const isSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  await session.reqAdminMode(req)
  next()
}

const isAdmin = (sessionState: SessionStateAuthenticated, owner: Account): boolean => {
  return (!!sessionState.user.adminMode || getOwnerRole(sessionState, owner) === 'admin')
}

const isContrib = (sessionState: SessionStateAuthenticated, owner: Account) => {
  return (!!sessionState.user.adminMode || ['admin', 'contrib'].includes(getOwnerRole(sessionState, owner) || ''))
}

const isMember = (sessionState: SessionStateAuthenticated, owner: Account):boolean => {
  return (!!sessionState.user.adminMode || !!getOwnerRole(sessionState, owner))
}

const getOwnerPermissionFilter = (sessionState: SessionStateAuthenticated, owner: AccountKeys) => {
  interface Filter {
    'owner.type': string
    'owner.id': string
    'owner.department'?: string
    permissions?: {
      $elemMatch: {
        profile: { $in: ['read', 'exec'] }
        $or: Array<{ [key: string]: any }>
      }
    }
  }

  const filter: Filter = {
    'owner.type': owner.type,
    'owner.id': owner.id
  }
  if (owner.department) filter['owner.department'] = owner.department
  if (sessionState.user.adminMode || ['admin', 'contrib'].includes(getOwnerRole(sessionState, owner) || '')) return filter
  const or: Array<{ [key: string]: any }> = [{ 'target.type': 'userEmail', 'target.email': sessionState.user.email }]
  if (sessionState.account.type === 'organization') {
    or.push({ 'target.type': 'partner', 'target.organization.id': sessionState.account.id, 'target.roles': sessionState.accountRole })
  }
  filter.permissions = {
    $elemMatch: {
      profile: { $in: ['read', 'exec'] },
      $or: or
    }
  }
  return filter
}

const matchPermissionTarget = (target: any, sessionState: SessionStateAuthenticated): boolean => {
  if (target.type === 'userEmail' && target.email === sessionState.user.email) return true
  if (target.type === 'partner' && sessionState.account.type === 'organization' && sessionState.account.id === target.organization.id && target.roles.includes(sessionState.accountRole)) return true
  return false
}

const getUserResourceProfile = (owner: Account, permissions: Permission[] | undefined, sessionState: SessionStateAuthenticated): string | undefined => {
  // this line is first, a manual permission cannot demote an admin
  const ownerRole = sessionState.user.adminMode ? 'admin' : getOwnerRole(sessionState, owner)
  if (ownerRole === 'admin') return 'admin'
  for (const profile of ['read', 'exec']) {
    if (permissions && permissions.find((p) => p.profile === profile && matchPermissionTarget(p.target, sessionState))) {
      return profile
    }
  }
  if (ownerRole === 'contrib') return 'read'
}

export default {
  getOwnerRole,
  isSuperAdmin,
  isAdmin,
  isContrib,
  isMember,
  getOwnerPermissionFilter,
  getUserResourceProfile
}
