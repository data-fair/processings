exports.isAccountAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).send()
  if (!['organization', 'user'].includes(req.params.type)) return res.status(400).send('Wrong consumer type')
  if (req.params.type === 'user') {
    if (req.user.id !== req.params.id) return res.status(403).send()
    req.consumer = { type: 'user', id: req.user.id, name: req.user.name }
  }
  if (req.params.type === 'organization') {
    const org = req.user.organizations.find(o => o.id === req.params.id && o.role === 'admin')
    if (!org) return res.status(403).send()
    req.consumer = { type: 'organization', id: org.id, name: org.name }
  }
  next()
}

exports.isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).send()
  if (!req.user.adminMode) return res.status(403).send()
  next()
}

exports.isOwner = (user, resource) => {
  if (user.adminMode) return true
  if (!resource.owner) return false
  if (resource.owner.type === 'user' && user.id === resource.owner.id) return true
  if (!resource.owner.type || resource.owner.type === 'organization') {
    const org = user.organizations.find(o => o.id === resource.owner.id && o.role === 'admin')
    if (org) return true
  }
  return false
}
