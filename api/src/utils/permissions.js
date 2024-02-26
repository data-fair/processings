import { session } from '@data-fair/lib/express/index.js'

const getOwnerRole = (owner, reqSession) => {
  if (!reqSession) return null
  if (reqSession.account.department) return null
  if (reqSession.account.type !== owner.type || reqSession.account.id !== owner.id) return null
  if (reqSession.account.type === 'user') return 'admin'
  return reqSession.accountRole
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

const isContrib = (reqSession, resource) => {
  return (reqSession.user.adminMode || getOwnerRole(resource.owner, reqSession) === 'admin' || getOwnerRole(resource.owner, reqSession) === 'contrib')
}
const isMember = (reqSession, resource) => {
  return (reqSession.user.adminMode || !!getOwnerRole(resource.owner, reqSession))
}
const isAccountMember = (req, res, next) => {
  if (!req.user) return res.status(401).send()
  if (req.user.adminMode) return next()
  if (!['organization', 'user'].includes(req.params.type)) return res.status(400).send('Wrong consumer type')
  if (req.params.type === 'user') {
    if (req.user.id !== req.params.id) return res.status(403).send()
  }
  if (req.params.type === 'organization') {
    const org = req.user.organizations.find(o => o.id === req.params.id)
    if (!org) return res.status(403).send()
  }
  next()
}

const getOwnerPermissionFilter = (owner, reqSession) => {
  const filter = {
    'owner.type': owner.type,
    'owner.id': owner.id
  }
  if (reqSession.user.adminMode || ['admin', 'contrib'].includes(getOwnerRole(owner, reqSession))) return filter
  const or = [{ 'target.type': 'userEmail', 'target.email': reqSession.user.email }]
  if (reqSession.account.type === 'organization') {
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

const matchPermissionTarget = (target, reqSession) => {
  if (target.type === 'userEmail' && target.email === reqSession.user.email) return true
  if (target.type === 'partner' && reqSession.account.type === 'organization' && reqSession.account.id === target.organization.id && target.roles.includes(reqSession.accountRole)) return true
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
  isAccountMember,
  getOwnerPermissionFilter,
  getUserResourceProfile
}
