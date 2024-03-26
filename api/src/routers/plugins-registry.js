import { asyncHandler } from '@data-fair/lib/express/index.js'
import { Router } from 'express'
import axios from '@data-fair/lib/node/axios.js'
import memoize from 'memoizee'

const router = Router()
export default router

const search = memoize(async (/** @type {any} */q, res) => {
  // see https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
  const response = await axios.get('https://registry.npmjs.org/-/v1/search', {
    params: {
      size: 250,
      text: `keywords:data-fair-processings-plugin ${q || ''}`
    }
  })

  for (const o of response.data.objects) {
    if (!o.package.keywords || !o.package.keywords.includes('data-fair-processings-plugin')) continue
    const distTags = (await axios.get('https://registry.npmjs.org/-/package/' + o.package.name + '/dist-tags')).data
    const plugin = { name: o.package.name, description: o.package.description }
    for (const distTag in distTags) {
      const result = { ...plugin, version: distTags[distTag], distTag }
      res.write(JSON.stringify(result) + '\n') // send data after each plugin loaded
    }
  }
  res.end()
}, {
  maxAge: 5 * 60 * 1000 // cached for 5 minutes to be polite with npmjs
})

router.get('/', asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  await search(req.query.q, res)
}))
