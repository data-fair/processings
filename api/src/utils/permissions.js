import { session } from '@data-fair/lib/express/index.js'

/**
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @returns {string|undefined}
 */
const getOwnerRole = (owner, reqSession) => {
  if (!reqSession) return
  if (reqSession.account?.department) return 'admin'
  if (reqSession.account?.type !== owner.type || reqSession.account?.id !== owner.id) return
  if (reqSession.account?.type === 'user') return 'admin'
  return reqSession.accountRole
}

const isSuperAdmin = async (req, res, next) => {
  const reqSession = await session.reqAuthenticated(req)
  if (!reqSession.user) return res.status(401).send()
  if (!reqSession.user.adminMode) return res.status(403).send()
  next()
}

const isAccountMember = async (req, res, next) => {
  const reqSession = await session.reqAuthenticated(req)
  if (!reqSession.user) return res.status(401).send()
  if (reqSession.user.adminMode) return next()
  if (!['organization', 'user'].includes(req.params.type)) return res.status(400).send('Wrong consumer type')
  if (req.params.type === 'user') {
    if (reqSession.user.id !== req.params.id) return res.status(403).send()
  }
  if (req.params.type === 'organization') {
    const org = reqSession.user.organizations.find(o => o.id === req.params.id)
    if (!org) return res.status(403).send()
  }
  next()
}

/**
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean | number}
 */
const isAdmin = (reqSession, owner) => {
  return (reqSession.user?.adminMode || getOwnerRole(owner, reqSession) === 'admin')
}
/**
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean | number}
 */
const isContrib = (reqSession, owner) => {
  return (reqSession.user?.adminMode || getOwnerRole(owner, reqSession) === 'admin' || getOwnerRole(owner, reqSession) === 'contrib')
}
/**
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @returns {boolean | number}
 */
const isMember = (reqSession, owner) => {
  return (reqSession.user?.adminMode || !!getOwnerRole(owner, reqSession))
}

/**
 * @param {import('@data-fair/lib/express/index.js').Account} owner
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @returns {any}
 */
const getOwnerPermissionFilter = (owner, reqSession) => {
  /** @type {any} */
  const filter = {
    'owner.type': owner.type,
    'owner.id': owner.id
  }
  if (reqSession.user?.adminMode || ['admin', 'contrib'].includes(getOwnerRole(owner, reqSession))) return filter
  /** @type {any[]} */
  const or = [{ 'target.type': 'userEmail', 'target.email': reqSession.user?.email }]
  if (reqSession.account?.type === 'organization') {
    or.push({ 'target.type': 'partner', 'target.organization.id': reqSession.account.id, 'target.roles': reqSession.accountRole })
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
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @returns {boolean}
 */
const matchPermissionTarget = (target, reqSession) => {
  if (target.type === 'userEmail' && target.email === reqSession.user?.email) return true
  if (target.type === 'partner' && reqSession.account?.type === 'organization' && reqSession.account?.id === target.organization.id && target.roles.includes(reqSession.accountRole)) return true
  return false
}

/**
 * @param {import('../../../shared/types/processing/index.js').Processing} processing
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @returns {string|undefined}
 */
const getUserResourceProfile = (processing, reqSession) => {
  if (!reqSession.user) return

  // this line is first, a manual permission cannot demote an admin
  const ownerRole = getOwnerRole(processing.owner, reqSession)
  if (ownerRole === 'admin') {
    // if (req.secondaryHost) return 'exec' // no admin functionality in portals
    // else return 'admin'
    return 'admin'
  }
  for (const profile of ['read', 'exec']) {
    if (processing.permissions && processing.permissions.find(p => p.profile === profile && matchPermissionTarget(p.target, reqSession))) {
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
