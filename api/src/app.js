import express from 'express'
import { session, errorHandler } from '@data-fair/lib/express/index.js'

import pluginsRegistryRouter from './routers/plugins-registry.js'
import pluginsRouter from './routers/plugins.js'
import processingsRouter from './routers/processings.js'
import runsRouter from './routers/runs.js'
import limitsRouter from './utils/limits.js'

export const app = express()

// no fancy embedded arrays, just string and arrays of strings in req.query
app.set('query parser', 'simple')
app.use(session.middleware())

app.set('json spaces', 2)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/v1/plugins-registry', pluginsRegistryRouter)
app.use('/api/v1/plugins', pluginsRouter)
app.use('/api/v1/processings', processingsRouter)
app.use('/api/v1/runs', runsRouter)
app.use('/api/v1/limits', limitsRouter)

app.use(errorHandler)
