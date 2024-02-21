import { session } from '@data-fair/lib/express/index.js'

const getOwnerRole = (owner, reqSession) => {
  if (!reqSession) return null
  if (reqSession.account.department) return null
  if (reqSession.account.type !== owner.type || reqSession.account.id !== owner.id) return null
  if (reqSession.account.type === 'user') return 'admin'
  return reqSession.account.role
}

const isSuperAdmin = async (req, res, next) => {
  const reqSession = await session.reqAuthenticated(req)
  if (!reqSession.user) return res.status(401).send()
  if (!reqSession.user.adminMode) return res.status(403).send()
  next()
}

const isAdmin = (reqSession, resource) => {
  return (reqSession.user.adminMode || getOwnerRole(resource.owner, reqSession) === 'admin')
}

const isContrib = (user, resource) => {
  return (user.adminMode || getOwnerRole(resource.owner, user) === 'admin' || getOwnerRole(resource.owner, user) === 'contrib')
}
const isMember = (reqSession, resource) => {
  return (reqSession.user.adminMode || !!getOwnerRole(resource.owner, reqSession))
}

const getOwnerPermissionFilter = (owner, reqSession) => {
  const filter = {
    'owner.type': owner.type,
    'owner.id': owner.id
  }
  if (reqSession.user.adminMode || ['admin', 'contrib'].includes(getOwnerRole(owner, reqSession))) return filter
  const or = [{ 'target.type': 'userEmail', 'target.email': reqSession.user.email }]
  if (reqSession.account.type === 'organization') {
    or.push({ 'target.type': 'partner', 'target.organization.id': reqSession.account.id, 'target.roles': reqSession.account.role })
  }
  filter.permissions = {
    $elemMatch: {
      profile: { $in: ['read', 'exec'] },
      $or: or
    }
  }
  return filter
}

const matchPermissionTarget = (target, reqSession) => {
  if (target.type === 'userEmail' && target.email === reqSession.user.email) return true
  if (target.type === 'partner' && reqSession.account.type === 'organization' && reqSession.account.id === target.organization.id && target.roles.includes(reqSession.account.role)) return true
  return false
}

const getUserResourceProfile = (processing, reqSession) => {
  if (!reqSession.user) return null

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
  return null
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
