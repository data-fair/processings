const config = require('config')
const express = require('express')
const router = module.exports = express.Router()
const memoize = require('memoizee')
const axios = require('../utils/axios')
const asyncWrap = require('../utils/async-wrap')

const axiosOpts = {}
if (config.npm.httpsProxy) {
  const proxyUrl = new URL(config.npm.httpsProxy)
  // cf https://axios-http.com/docs/req_config
  axiosOpts.proxy = { protocol: proxyUrl.protocol, host: proxyUrl.hostname }
  if (proxyUrl.port) axiosOpts.proxy.port = proxyUrl.port
  if (proxyUrl.username) axiosOpts.proxy.auth = { username: proxyUrl.username, password: proxyUrl.password }
}

const search = memoize(async (q) => {
  // see https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
  const res = await axios.get('https://registry.npmjs.org/-/v1/search', {
    ...axiosOpts,
    params: {
      size: 250,
      text: `keywords:data-fair-processings-plugin ${q || ''}`
    }
  })
  const results = []
  for (const o of res.data.objects) {
    if (!o.package.keywords || !o.package.keywords.includes('data-fair-processings-plugin')) continue
    const details = (await axios.get('https://registry.npmjs.org/' + o.package.name, axiosOpts)).data
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
