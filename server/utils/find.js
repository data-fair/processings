const createError = require('http-errors')

// Util functions shared accross the main find (GET on collection) endpoints

exports.query = (req, fieldsMap = {}) => {
  const query = {}

  if (req.query.q) query.$text = { $search: req.query.q }

  const showAll = req.query.showAll === 'true'
  if (showAll && !req.user.adminMode) {
    throw createError(400, 'Only super admins can override permissions filter with showAll parameter')
  }
  if (!showAll) {
    query['owner.type'] = req.user.activeAccount.type
    query['owner.id'] = req.user.activeAccount.id
  }

  Object.keys(fieldsMap).filter(name => req.query[name] !== undefined).forEach(name => {
    query[fieldsMap[name]] = { $in: req.query[name].split(',') }
  })
  return query
}

exports.sort = (sortStr) => {
  const sort = {}
  if (!sortStr) return sort
  Object.assign(sort, ...sortStr.split(',').map(s => {
    const toks = s.split(':')
    return {
      [toks[0]]: Number(toks[1])
    }
  }))
  return sort
}

exports.pagination = (query, defaultSize = 10) => {
  let size = defaultSize
  if (query && query.size && !isNaN(parseInt(query.size))) {
    size = parseInt(query.size)
  }

  let skip = 0
  if (query && query.skip && !isNaN(parseInt(query.skip))) {
    skip = parseInt(query.skip)
  } else if (query && query.page && !isNaN(parseInt(query.page))) {
    skip = (parseInt(query.page) - 1) * size
  }

  return [skip, size]
}
