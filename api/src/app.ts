import { session, errorHandler } from '@data-fair/lib-express/index.js'
import express from 'express'

import limitsRouter from './routers/limits.ts'
import pluginsRegistryRouter from './routers/plugins-registry.ts'
import pluginsRouter from './routers/plugins.ts'
import processingsRouter from './routers/processings.ts'
import runsRouter from './routers/runs.ts'

export const app = express()

// no fancy embedded arrays, just string and arrays of strings in req.query
app.set('query parser', 'simple')

app.use(session.middleware())

app.set('json spaces', 2)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/processings/api/plugins-registry', pluginsRegistryRouter)
app.use('/processings/api/plugins', pluginsRouter)
app.use('/processings/api/processings', processingsRouter)
app.use('/processings/api/runs', runsRouter)
app.use('/processings/api/limits', limitsRouter)

app.use(errorHandler)
