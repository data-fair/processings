const express = require('express')
const findUtils = require('../utils/find')
const asyncWrap = require('../utils/async-wrap')
const permissions = require('../utils/permissions')
const session = require('../utils/session')
const router = express.Router()

module.exports = router

router.get('', session.requiredAuth, permissions.isAdmin, asyncWrap(async (req, res, next) => {
  const sort = findUtils.sort(req.query.sort)
  const [skip, size] = findUtils.pagination(req.query)
  const query = findUtils.query(req, { processing: 'processing._id' })
  const project = { log: 0 }
  const runs = req.app.get('db').collection('runs')
  const [results, count] = await Promise.all([
    size > 0 ? runs.find(query).limit(size).skip(skip).sort(sort).project(project).toArray() : Promise.resolve([]),
    runs.countDocuments(query),
  ])
  res.json({ results, count })
}))
