const express = require('express')
const router = module.exports = express.Router()
const memoize = require('memoizee')
const axios = require('../utils/axios')
const asyncWrap = require('../utils/async-wrap')

const search = memoize(async (q) => {
  // see https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
  const res = await axios.get('https://registry.npmjs.org/-/v1/search', {
    params: {
      size: 250,
      text: `keywords:data-fair-processings-plugin ${q || ''}`
    }
  })
  const results = []
  for (const o of res.data.objects) {
    if (!o.package.keywords || !o.package.keywords.includes('data-fair-processings-plugin')) continue
    const details = (await axios.get('https://registry.npmjs.org/' + o.package.name)).data
    const plugin = { name: o.package.name, description: o.package.description, npm: o.package.links.npm }
    for (const distTag in details['dist-tags']) {
      results.push({ ...plugin, version: details['dist-tags'][distTag], distTag })
    }
  }
  return {
    count: results.length,
    results
  }
}, {
  maxAge: 5 * 60 * 1000 // cached for 5 minutes to be polite with npmjs
})

router.get('/', asyncWrap(async (req, res, next) => {
  res.send(await search(req.query.q))
}))
