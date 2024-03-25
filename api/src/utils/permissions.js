import { session } from '@data-fair/lib/express/index.js'

/**
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @param {import('@data-fair/lib/express/index.js').SessionState} sessionState
 * @returns {string|undefined}
 */
const getOwnerRole = (owner, sessionState) => {
  if (!sessionState) return
  if (sessionState.account?.department) return 'admin'
  if (sessionState.account?.type !== owner.type || sessionState.account?.id !== owner.id) return
  if (sessionState.account?.type === 'user') return 'admin'
  return sessionState.accountRole
}

/**
 * Middleware to check if the user is a super admin
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<any>} 401 if not authenticated, 403 if not super admin
 */
const isSuperAdmin = async (req, res, next) => {
  const sessionState = await session.readState(req)
  if (!sessionState.user) return res.status(401).send()
  if (!sessionState.user.adminMode) return res.status(403).send()
  next()
}

/**
 * Middleware to check the req.params (representing a user account or organization)
 * indeed belongs to the currently logged-in user,
 * or to an organization of which the currently logged-in user is a member.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const isAccountMember = async (req, res, next) => {
  const sessionState = await session.readState(req)
  if (!sessionState.user) return res.status(401).send()
  if (sessionState.user.adminMode) return next()
  if (!['organization', 'user'].includes(req.params.type)) return res.status(400).send('Wrong consumer type')
  if (req.params.type === 'user') {
    if (sessionState.user.id !== req.params.id) return res.status(403).send()
  }
  if (req.params.type === 'organization') {
    const org = sessionState.user.organizations.find(o => o.id === req.params.id)
    if (!org) return res.status(403).send()
  }
  next()
}

/**
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean | number}
 */
const isAdmin = (sessionState, owner) => {
  return (sessionState.user?.adminMode || getOwnerRole(owner, sessionState) === 'admin')
}
/**
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean | number}
 */
const isContrib = (sessionState, owner) => {
  return (sessionState.user?.adminMode || ['admin', 'contrib'].includes(getOwnerRole(owner, sessionState) || ''))
}
/**
 * @param {import('@data-fair/lib/express/index.js').SessionStateAuthenticated} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean | number}
 */
const isMember = (sessionState, owner) => {
  return (sessionState.user?.adminMode || !!getOwnerRole(owner, sessionState))
}

/**
 * @param {import('@data-fair/lib/express/index.js').SessionState} sessionState
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {any}
 */
const getOwnerPermissionFilter = (sessionState, owner) => {
  /** @type {any} */
  const filter = {
    'owner.type': owner.type,
    'owner.id': owner.id
  }
  // @ts-ignore
  if (sessionState.user?.adminMode || ['admin', 'contrib'].includes(getOwnerRole(owner, sessionState))) return filter
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
 * @param {import('../../../shared/types/permission/index.js').Permission[]} permissions
 * @param {import('@data-fair/lib/express/index.js').SessionState} sessionState
 * @returns {string|undefined}
 */
const getUserResourceProfile = (owner, permissions, sessionState) => {
  if (!sessionState.user) return

  // this line is first, a manual permission cannot demote an admin
  const ownerRole = getOwnerRole(owner, sessionState)
  if (ownerRole === 'admin') {
    // TODO // if (req.secondaryHost) return 'exec' // no admin functionality in portals
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
  isAccountMember,
  getOwnerPermissionFilter,
  getUserResourceProfile
}
