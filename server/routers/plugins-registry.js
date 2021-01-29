const express = require('express')
const router = module.exports = express.Router()
const memoize = require('memoizee')
const axios = require('axios')
const asyncWrap = require('../utils/async-wrap')

const search = memoize(async (q) => {
  // see https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
  const res = await axios.get('http://registry.npmjs.com/-/v1/search', {
    params: {
      size: 250,
      text: `"data-fair-processings-plugin" ${q || ''}`
    }
  })
  return {
    count: res.data.total,
    results: res.data.objects
      .filter(o => o.package.keywords && o.package.keywords.includes('data-fair-processings-plugin'))
      .map(o => ({ name: o.package.name, version: o.package.version, description: o.package.description, npm: o.package.links.npm }))
  }
})

router.get('/', asyncWrap(async (req, res, next) => {
  res.send(await search(req.query.q))
}))
