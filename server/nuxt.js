const { Nuxt } = require('nuxt')

const nuxtConfig = require('../nuxt.config.js')

module.exports = async () => {
  if (process.env.NODE_ENV === 'development') {
    // in dev mode the nuxt dev server is already running, we re-expose it
    return require('http-proxy-middleware')({ target: 'http://localhost:3039' })
  } else {
    // Prepare nuxt for rendering and serving UI
    const nuxt = new Nuxt(nuxtConfig)
    return async (req, res, next) => {
      // re-apply the prefix that was removed by an optional reverse proxy
      req.url = (nuxtConfig.router.base + req.url).replace('//', '/')
      nuxt.render(req, res)
    }
  }
}
