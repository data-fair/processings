import createError from 'http-errors'
import permissions from './permissions.js'

// Util functions shared accross the main find (GET on collection) endpoints
const query = (req, reqSession, fieldsMap = {}) => {
  const query = {}

  if (req.query.q) query.$text = { $search: req.query.q }

  const showAll = req.query.showAll === 'true'
  if (showAll && !reqSession.user.adminMode) {
    throw createError(400, 'Only super admins can override permissions filter with showAll parameter')
  }
  if (!showAll) {
    let owner = reqSession.account
    if (req.query.owner) {
      const ownerParts = req.query.owner.split(':')
      owner = { type: ownerParts[0], id: ownerParts[1], department: ownerParts[2] }
    }
    Object.assign(query, permissions.getOwnerPermissionFilter(owner, reqSession))
  }

  Object.keys(fieldsMap).filter(name => req.query[name] !== undefined).forEach(name => {
    query[fieldsMap[name]] = { $in: req.query[name].split(',') }
  })
  return query
}

const sort = (sortStr) => {
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

const pagination = (query, defaultSize = 10) => {
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

const project = (selectStr) => {
  const select = {}
  if (selectStr) {
    selectStr.split(',').forEach(s => {
      select[s] = 1
    })
  }
  return select
}

export default {
  query,
  sort,
  pagination,
  project
}
