import { asyncHandler } from '@data-fair/lib/express/index.js'
import { Router } from 'express'
import axios from '@data-fair/lib/node/axios.js'
import config from '../config.js'
import memoize from 'memoize'

const router = Router()
export default router

/** @type {import('axios').AxiosRequestConfig} */
const axiosOpts = {}

if (config.npm?.httpsProxy) {
  const proxyUrl = new URL(config.npm?.httpsProxy)
  // cf https://axios-http.com/docs/req_config
  axiosOpts.proxy = {
    protocol: proxyUrl.protocol,
    host: proxyUrl.hostname,
    port: proxyUrl.port ? Number(proxyUrl.port) : (proxyUrl.protocol === 'https:' ? 443 : 80)
  }
  if (proxyUrl.username) axiosOpts.proxy.auth = { username: proxyUrl.username, password: proxyUrl.password }
}

/**
 * Search for plugins in the npm registry
 * @param {string} q - search query
 * @param {boolean} showAll - if true, return all versions of each plugin
 */
const search = memoize(async (q, showAll) => {
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
    const plugin = { name: o.package.name, description: o.package.description, version: o.package.version }

    if (showAll) {
      // @ts-ignore
      const distTags = (await axios.get('https://registry.npmjs.org/-/package/' + o.package.name + '/dist-tags', axiosOpts)).data
      for (const distTag in distTags) {
        results.push({ ...plugin, version: distTags[distTag], distTag })
      }
    } else {
      results.push({ ...plugin, distTag: 'latest' })
    }
  }
  return {
    count: results.length,
    results
  }
}, {
  cacheKey: arguments_ => arguments_.join(','),
  maxAge: 5 * 60 * 1000 // cached for 5 minutes to be polite with npmjs
})

/**
 * Search for plugins in the npm registry
 * @route GET /plugins-registry
 * @param {string} q.query - search query
 * @param {boolean} showAll.query - if true, return all versions of each plugin
 * @returns {object} 200 - An object with the count of results and an array of plugins
 */
router.get('/', asyncHandler(async (req, res) => {
  res.send(await search(req.query.q, req.query.showAll === 'true' || false))
}))
