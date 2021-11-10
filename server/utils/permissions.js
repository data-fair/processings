exports.getOwnerRole = (owner, user) => {
  if (!user) return null
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
