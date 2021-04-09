const config = require('config')
const express = require('express')
const http = require('http')
const { URL } = require('url')
const event2promise = require('event-to-promise')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const proxy = require('http-proxy-middleware')
const nuxt = require('./nuxt')
const session = require('@koumoul/sd-express')({
  publicUrl: config.publicUrl,
  directoryUrl: config.directoryUrl,
  cookieDomain: config.sessionDomain,
})
const debug = require('debug')('main')

const publicHost = new URL(config.publicUrl).host
debug('Public host', publicHost)

// Second express application for proxying requests based on host
const app = express()

// re-expose remote data-fair using local api-key
const dataFairUrl = new URL(config.dataFairUrl)
const dataFairIsLocal = new URL(config.publicUrl).origin === dataFairUrl.origin
if (!dataFairIsLocal) {
  app.use('/data-fair-proxy', session.auth, proxy({
    target: dataFairUrl.origin,
    pathRewrite: { '^/data-fair-proxy': dataFairUrl.pathname },
    secure: false,
    logLevel: 'debug',
    changeOrigin: true,
    onProxyReq (proxyReq, req, res) {
      if (!req.user || !req.user.adminMode) return res.status(403).send('Super admin only')
      proxyReq.setHeader('cookie', '')
      proxyReq.setHeader('x-apiKey', config.dataFairAPIKey)
    },
  }))
}

if (process.env.NODE_ENV === 'development') {
  // Create a mono-domain environment with other services in dev
  app.use('/simple-directory', proxy({ target: 'http://localhost:8080', pathRewrite: { '^/simple-directory': '' } }))
  app.use('/data-fair', proxy({ target: 'http://localhost:8081', pathRewrite: { '^/data-fair': '' }, ws: true }))
}

app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.text())

app.use('/api/v1/session', session.router)
app.use('/api/v1/processings', require('./routers/processings'))
app.use('/api/v1/runs', require('./routers/runs'))
app.use('/api/v1/plugins-registry', require('./routers/plugins-registry'))
app.use('/api/v1/plugins', require('./routers/plugins'))

let httpServer
exports.start = async ({ db }) => {
  const nuxtMiddleware = await nuxt()
  app.use(session.loginCallback)
  app.use(session.decode)
  app.use(nuxtMiddleware)
  app.set('db', db)
  app.use((err, req, res, next) => {
    console.error('Error in HTTP request', err.response ? err.response.data : err)
    res.status(err.status || 500).send(err.message)
  })

  httpServer = http.createServer(app).listen(config.port)
  await event2promise(httpServer, 'listening')
  console.log('HTTP server is listening', config.port)
}

exports.stop = async () => {
  if (httpServer) {
    httpServer.close()
    await event2promise(httpServer, 'close')
  }
}
