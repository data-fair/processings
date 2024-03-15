import createError from 'http-errors'
import permissions from './permissions.js'

// Util functions shared accross the main find (GET on collection) endpoints
/**
 * @param {any} reqQuery - The query parameters from the request
 * @param {import('@data-fair/lib/express/index.js').SessionState} reqSession
 * @param {Object<string, string>} fieldsMap
 */
const query = (reqQuery, reqSession, fieldsMap = {}) => {
  /** @type {any} */
  const query = {}

  if (reqQuery.q) query.$text = { $search: reqQuery.q }

  const showAll = reqQuery.showAll === 'true'
  if (showAll && !reqSession.user?.adminMode) {
    throw createError(400, 'Only super admins can override permissions filter with showAll parameter')
  }
  if (!showAll) {
    let owner = reqSession.account
    if (reqQuery.owner) {
      const ownerParts = reqQuery.owner.split(':')
      owner = { type: ownerParts[0], id: ownerParts[1], department: ownerParts[2] }
    }
    Object.assign(query, permissions.getOwnerPermissionFilter(owner, reqSession))
  }

  Object.keys(fieldsMap).filter(name => reqQuery[name] !== undefined).forEach(name => {
    query[fieldsMap[name]] = { $in: reqQuery[name].split(',') }
  })
  return query
}

/**
 * @param {any} sortStr
 * @returns {any}
 */
const sort = (sortStr) => {
  const sort = {}
  if (!sortStr) return sort
  Object.assign(sort, ...sortStr.split(',').map((/** @type {String} */ s) => {
    const toks = s.split(':')
    return {
      [toks[0]]: Number(toks[1])
    }
  }))
  return sort
}

/**
 * @param {string|undefined} size
 * @param {string|undefined} page
 * @param {string|undefined} skip
 * @returns {[number, number]} - [size, skip]
 */
const pagination = (size, page, skip) => {
  let sizeInt = 10
  if (size && !isNaN(parseInt(size))) {
    sizeInt = parseInt(size)
  }

  let skipInt = 0
  if (skip && !isNaN(parseInt(skip))) {
    skipInt = parseInt(skip)
  } else if (page && !isNaN(parseInt(page))) {
    skipInt = (parseInt(page) - 1) * sizeInt
  }

  return [sizeInt, skipInt]
}

/**
 * @param {any} selectStr
 * @returns {Object<string, number>}
 */
const project = (selectStr) => {
  /** @type {Object<string, number>} */
  const select = {}
  if (selectStr) {
    selectStr.split(',').forEach((/** @type {string} */ s) => {
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
