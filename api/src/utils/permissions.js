import { session } from '@data-fair/lib/express/index.js'
import config from '../config.js'

/**
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {string|undefined}
 */
const getOwnerRole = (sessionState, owner) => {
  if (!sessionState) return
  if (sessionState.account.department) return 'admin'
  if (sessionState.account.type !== owner.type || sessionState.account?.id !== owner.id) return
  if (sessionState.account.type === 'user') return 'admin'
  return sessionState.accountRole
}

/**
 * Middleware to check if the user is a super admin
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
const isSuperAdmin = async (req, res, next) => {
  await session.reqAdminMode(req)
  next()
}

/**
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean}
 */
const isAdmin = (sessionState, owner) => {
  return (!!sessionState.user.adminMode || getOwnerRole(sessionState, owner) === 'admin')
}
/**
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean}
 */
const isContrib = (sessionState, owner) => {
  return (!!sessionState.user.adminMode || ['admin', 'contrib'].includes(getOwnerRole(sessionState, owner) || ''))
}
/**
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean}
 */
const isMember = (sessionState, owner) => {
  return (!!sessionState.user.adminMode || !!getOwnerRole(sessionState, owner))
}

/**
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {any}
 */
const getOwnerPermissionFilter = (sessionState, owner) => {
  /** @type {any} */
  const filter = {
    'owner.type': owner.type,
    'owner.id': owner.id
  }
  if (sessionState.user?.adminMode || ['admin', 'contrib'].includes(getOwnerRole(sessionState, owner) || '')) return filter
  /** @type {any[]} */
  const or = [{ 'target.type': 'userEmail', 'target.email': sessionState.user?.email }]
  if (sessionState.account?.type === 'organization') {
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

/**
 * @param {any} target
 * @param {import('@data-fair/lib/express/index.js').SessionState} sessionState
 * @returns {boolean}
 */
const matchPermissionTarget = (target, sessionState) => {
  if (target.type === 'userEmail' && target.email === sessionState.user?.email) return true
  if (target.type === 'partner' && sessionState.account?.type === 'organization' && sessionState.account?.id === target.organization.id && target.roles.includes(sessionState.accountRole)) return true
  return false
}

/**
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @param {import('../../../shared/types/permission/index.js').Permission[] | undefined} permissions
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {string|undefined} host req.headers.host
 * @returns {string | undefined}
 */
const getUserResourceProfile = (owner, permissions, sessionState, host) => {
  // this line is first, a manual permission cannot demote an admin
  const ownerRole = getOwnerRole(sessionState, owner)
  if (ownerRole === 'admin') {
    if (new URL(config.origin).host !== host) return 'exec' // no admin functionality in portals
    return 'admin'
  }
  for (const profile of ['read', 'exec']) {
    if (permissions && permissions.find((/** @type {import('../../../shared/types/permission/index.js').Permission} */ p) => p.profile === profile && matchPermissionTarget(p.target, sessionState))) {
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
