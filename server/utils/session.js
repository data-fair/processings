const config = require('config')

module.exports = require('@koumoul/sd-express')({
  publicUrl: config.publicUrl,
  directoryUrl: config.directoryUrl,
  cookieDomain: config.sessionDomain,
})
