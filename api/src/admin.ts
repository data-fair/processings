import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { Router } from 'express'
import { reqOrigin, session } from '@data-fair/lib-express/index.js'
import getApiDoc from '#doc/api-docs.ts'

const router = Router()
export default router

// All routes in the router are only for the super admins of the service
router.use(async (req, res, next) => {
  await session.reqAdminMode(req)
  next()
})

let info = { version: process.env.NODE_ENV }
try { info = JSON.parse(await readFile(resolve(import.meta.dirname, '../../BUILD.json'), 'utf8')) } catch (err) {}
router.get('/info', (req, res) => {
  res.send(info)
})

// Get the full API documentation of the service
router.get('/api-docs.json', async (req, res) => {
  res.json(getApiDoc(reqOrigin(req), { isSuperAdmin: true }))
})
