import { resolve } from 'node:path'
import express from 'express'
import { session, errorHandler, createSiteMiddleware, createSpaMiddleware, defaultNonceCSPDirectives } from '@data-fair/lib-express/index.js'
import identitiesRouter from './misc/routers/identities.ts'
import limitsRouter from './limits/router.ts'
import processingsRouter from './processings/router.ts'
import runsRouter from './runs/router.ts'
import adminRouter from './admin/router.ts'
import apiDocs from '../contract/api-docs.ts'
import { readAgentSkill } from '../contract/skills.ts'
import config, { uiConfig } from '#config'

export const app = express()

// no fancy embedded arrays, just string and arrays of strings in req.query
app.set('query parser', 'simple')

app.use(createSiteMiddleware('processings'))

app.use(session.middleware())

app.set('json spaces', 2)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/v1/_ping', (req, res) => {
  res.send('ok')
})

// public, read by data-fair (private url, no forwarded headers) to merge it into its platform document
app.get('/api/v1/api-docs.json', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300')
  res.vary('Accept-Language')
  res.json(apiDocs(req.acceptsLanguages('fr', 'en') === 'en' ? 'en' : 'fr'))
})

// the bodies of the document's skills, linked from its x-agent.skills; public like the document
app.get('/api/v1/agents/skills/:file', (req, res) => {
  const body = req.params.file.endsWith('.md') ? readAgentSkill(req.params.file.slice(0, -3)) : undefined
  if (!body) return res.status(404).send('unknown skill')
  res.set('Cache-Control', 'public, max-age=300')
  res.type('text/markdown').send(body)
})

app.use('/api/identities', identitiesRouter)
app.use('/api/v1/processings', processingsRouter)
app.use('/api/v1/runs', runsRouter)
app.use('/api/v1/limits', limitsRouter)
app.use('/api/v1/admin', adminRouter)

if (process.env.NODE_ENV === 'development') {
  app.use('/api/v1/test-env', (await import('./misc/routers/test-env.ts')).default)
}

const cspDirectives = { ...defaultNonceCSPDirectives }
// necessary to use vjsf without pre-compilation
cspDirectives['script-src'] = "'unsafe-eval' " + defaultNonceCSPDirectives['script-src']
// necessary for vjsf to fetch remote services
cspDirectives['connect-src'] = "'self' https:"
app.use(await createSpaMiddleware(resolve(import.meta.dirname, '../../ui/dist'), uiConfig, {
  csp: { nonce: true, header: cspDirectives },
  privateDirectoryUrl: config.privateDirectoryUrl
}))

app.use(errorHandler)
