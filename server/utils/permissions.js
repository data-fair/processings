exports.getOwnerRole = (owner, user) => {
  if (!user) return null
  if (user.activeAccount.department) return null
  if (user.activeAccount.type !== owner.type || user.activeAccount.id !== owner.id) return null
  if (user.activeAccount.type === 'user') return 'admin'
  return user.activeAccount.role
}

exports.isSuperAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).send()
  if (!req.user.adminMode) return res.status(403).send()
  next()
}

exports.isAdmin = (user, resource) => {
  return (user.adminMode || exports.getOwnerRole(resource.owner, user) === 'admin')
}

exports.isContrib = (user, resource) => {
  return (user.adminMode || exports.getOwnerRole(resource.owner, user) === 'admin' || exports.getOwnerRole(resource.owner, user) === 'contrib')
}

exports.isMember = (user, resource) => {
  return (user.adminMode || !!exports.getOwnerRole(resource.owner, user))
}

exports.getOwnerPermissionFilter = (owner, user) => {
  const filter = {
    'owner.type': owner.type,
    'owner.id': owner.id
  }
  if (user.adminMode || ['admin', 'contrib'].includes(exports.getOwnerRole(owner, user))) return filter
  const or = [{ 'target.type': 'userEmail', 'target.email': user.email }]
  if (user.activeAccount.type === 'organization') {
    or.push({ 'target.type': 'partner', 'target.organization.id': user.activeAccount.id, 'target.roles': user.activeAccount.role })
  }
  filter.permissions = {
    $elemMatch: {
      profile: { $in: ['read', 'exec'] },
      $or: or
    }
  }
  return filter
}

const matchPermissionTarget = (target, user) => {
  if (target.type === 'userEmail' && target.email === user.email) return true
  if (target.type === 'partner' && user.activeAccount.type === 'organization' && user.activeAccount.id === target.organization.id && target.roles.includes(user.activeAccount.role)) return true
  return false
}

exports.getUserResourceProfile = (processing, req) => {
  if (!req.user) return null
  // this line is first, a manual permission cannot demote an admin
  if (exports.getOwnerRole(processing.owner, req.user) === 'admin') {
    if (req.secondaryHost) return 'exec' // no admin functionality in portals
    else return 'admin'
  }
  for (const profile of ['read', 'exec']) {
    if (processing.permissions && processing.permissions.find(p => p.profile === profile && matchPermissionTarget(p.target, req.user))) {
      return profile
    }
  }
  if (exports.getOwnerRole(processing.owner, req.user) === 'contrib') return 'read'
  return null
}
