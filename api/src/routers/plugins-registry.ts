import type { AxiosRequestConfig } from 'axios'
import { Router } from 'express'
import memoize from 'memoizee'

import axios from '@data-fair/lib-node/axios.js'
import config from '#config'

const router = Router()
export default router

const axiosOpts: AxiosRequestConfig = {}

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
 * @param q - search query
 * @param showAll - if true, return all versions of each plugin
 */
const search = async (q: string | undefined, showAll: boolean) => {
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
}
const memoizedSearch = memoize(search, {
  maxAge: 5 * 60 * 1000 // cached for 5 minutes to be polite with npmjs
})

router.get('/', async (req, res) => {
  if (req.query.q && typeof req.query.q !== 'string') {
    res.status(400).send('Invalid query')
    return
  }
  res.send(await memoizedSearch(req.query.q, req.query.showAll === 'true' || false))
})
