import { resolve } from 'node:path'
import express from 'express'
import { session, errorHandler, createSiteMiddleware, createSpaMiddleware } from '@data-fair/lib-express/index.js'
import identitiesRouter from './routers/identities.ts'
import limitsRouter from './routers/limits.ts'
import pluginsRegistryRouter from './routers/plugins-registry.ts'
import pluginsRouter from './routers/plugins.ts'
import processingsRouter from './routers/processings.ts'
import runsRouter from './routers/runs.ts'
import adminRouter from './admin.ts'
import config, { uiConfig } from '#config'

export const app = express()

// no fancy embedded arrays, just string and arrays of strings in req.query
app.set('query parser', 'simple')

app.use(createSiteMiddleware('processings'))

app.use(session.middleware())

app.set('json spaces', 2)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/identities', identitiesRouter)
app.use('/api/v1/plugins-registry', pluginsRegistryRouter)
app.use('/api/v1/plugins', pluginsRouter)
app.use('/api/v1/processings', processingsRouter)
app.use('/api/v1/runs', runsRouter)
app.use('/api/v1/limits', limitsRouter)
app.use('/api/v1/admin', adminRouter)

if (config.serveUi) {
  app.use(await createSpaMiddleware(resolve(import.meta.dirname, '../../ui/dist'), uiConfig))
}

app.use(errorHandler)
