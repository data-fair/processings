import { Router } from 'express'
import memoize from 'memoizee'
import axios from '@data-fair/lib/node/axios.js'
import { asyncHandler } from '@data-fair/lib/express/index.js'

const router = Router()
export default router

const search = memoize(async (q) => {
  // see https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
  const res = await axios.get('https://registry.npmjs.com/-/v1/search', {
    params: {
      size: 250,
      text: `keywords:data-fair-processings-plugin ${q || ''}`
    }
  })
  const results = []
  for (const o of res.data.objects) {
    if (!o.package.keywords || !o.package.keywords.includes('data-fair-processings-plugin')) continue
    const distTags = (await axios.get('https://registry.npmjs.com/-/package/' + o.package.name + '/dist-tags')).data
    const plugin = { name: o.package.name, description: o.package.description, npm: o.package.links.npm }
    for (const distTag in distTags) {
      results.push({ ...plugin, version: distTags[distTag], distTag })
    }
  }
  return {
    count: results.length,
    results
  }
}, {
  maxAge: 5 * 60 * 1000 // cached for 5 minutes to be polite with npmjs
})

router.get('/', asyncHandler(async (req, res) => {
  res.send(await search(req.query.q))
}))
