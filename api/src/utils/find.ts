import type { SessionStateAuthenticated } from '@data-fair/lib-express'

import { httpError } from '@data-fair/lib-utils/http-errors.js'
import permissions from './permissions.js'
import { AccountKeys } from '#types'

// Util functions shared accross the main find (GET on collection) endpoints
const query = (reqQuery: Record<string, string>, sessionState: SessionStateAuthenticated, fieldsMap: Record<string, string> = {}) => {
  const query: Record<string, any> = {}

  if (reqQuery.q) query.$text = { $search: reqQuery.q }

  const showAll = reqQuery.showAll === 'true'
  if (showAll && !sessionState.user.adminMode) {
    throw httpError(400, 'Only super admins can override permissions filter with showAll parameter')
  }
  if (!showAll) {
    let owner: AccountKeys = sessionState.account
    if (reqQuery.owner) {
      const ownerParts = reqQuery.owner.split(':')
      if (!(ownerParts[0] === 'user' || ownerParts[0] === 'organization')) {
        throw httpError(400, 'Owner type must be user or organization')
      }
      owner = { type: ownerParts[0], id: ownerParts[1], department: ownerParts[2] }
    }
    Object.assign(query, permissions.getOwnerPermissionFilter(sessionState, owner))
  }

  Object.keys(fieldsMap).filter(name => reqQuery[name] !== undefined).forEach(name => {
    query[fieldsMap[name]] = { $in: reqQuery[name].split(',') }
  })
  return query
}

const sort = (sortStr:string) => {
  const sort = {}
  if (!sortStr) return sort
  Object.assign(sort, ...sortStr.split(',').map((s:string) => {
    const toks = s.split(':')
    return {
      [toks[0]]: Number(toks[1])
    }
  }))
  return sort
}

const pagination = (size: string | undefined, page: string | undefined, skip: string | undefined): [number, number] => {
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

const project = (selectStr: string) => {
  const select: Record<string, number> = {}
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
