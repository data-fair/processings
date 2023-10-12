const EventEmitter = require('events')
const config = require('config')
const express = require('express')
const http = require('http')
const { URL } = require('url')
const event2promise = require('event-to-promise')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cors = require('cors')
const session = require('./utils/session')
const prometheus = require('./utils/prometheus')
const limits = require('./utils/limits')
const wsUtils = require('./utils/ws')
const debug = require('debug')('main')

const publicHost = new URL(config.publicUrl).host
debug('Public host', publicHost)

// a global event emitter for testing
global.events = new EventEmitter()

// Second express application for proxying requests based on host
const app = express()

app.set('json spaces', 2)

// re-expose remote data-fair using local api-key
const dataFairUrl = new URL(config.dataFairUrl)
const dataFairIsLocal = new URL(config.publicUrl).origin === dataFairUrl.origin
if (!dataFairIsLocal) {
  app.use('/data-fair-proxy', session.auth, createProxyMiddleware({
    target: dataFairUrl.origin,
    pathRewrite: { '^/data-fair-proxy': dataFairUrl.pathname },
    secure: false,
    logLevel: 'debug',
    changeOrigin: true,
    onProxyReq (proxyReq, req, res) {
      if (!req.user || !req.user.adminMode) return res.status(403).send('Super admin only')
      proxyReq.setHeader('cookie', '')
      proxyReq.setHeader('x-apiKey', config.dataFairAPIKey)
    }
  }))
}

app.use((req, res, next) => {
  req.secondaryHost = publicHost !== req.headers.host
  next()
})

if (process.env.NODE_ENV === 'development') {
  // Create a mono-domain environment with other services in dev
  app.use('/simple-directory', createProxyMiddleware({ target: 'http://localhost:8080', pathRewrite: { '^/simple-directory': '' } }))
  app.use('/data-fair', createProxyMiddleware({ target: 'http://localhost:8081', pathRewrite: { '^/data-fair': '' }, ws: true }))
  app.use('/notify', createProxyMiddleware({ target: 'http://localhost:8088', pathRewrite: { '^/notify': '' }, ws: true }))
}

app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.text())

app.use('/api/v1/processings', require('./routers/processings'))
app.use('/api/v1/runs', require('./routers/runs'))
app.use('/api/v1/plugins-registry', require('./routers/plugins-registry'))
app.use('/api/v1/plugins', require('./routers/plugins'))
app.use('/api/v1/limits', limits.router)

let server, wss
exports.start = async ({ db }) => {
  const nuxt = await require('./nuxt')()
  app.use(session.auth)
  app.use('/_nuxt', cors()) // prevent CORS errors when fetching fonts in multi-domain mode
  app.use(nuxt.render)
  app.set('db', db)

  app.use((err, req, res, next) => {
    const status = err.statusCode || err.status || 500
    if (status === 500) {
      console.error('(http) Error in express route', err)
      prometheus.internalError.inc({ errorCode: 'http' })
    }
    // settings content-type as plain text instead of html to prevent XSS attack
    res.type('text/plain')
    res.status(status).send(err.message)
  })

  await limits.init(db)

  const WebSocket = require('ws')
  server = http.createServer(app)

  wss = new WebSocket.Server({ server })
  await wsUtils.initServer(wss, db, session)

  server.listen(config.port)
  await event2promise(server, 'listening')
  console.log('HTTP server is listening http://localhost:' + config.port)
}

exports.stop = async () => {
  if (server) {
    wss.close()
    wsUtils.stop(wss)
    await event2promise(wss, 'close')
    server.close()
    await event2promise(server, 'close')
  }
}
