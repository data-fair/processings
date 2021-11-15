const config = require('config')

module.exports = require('@koumoul/sd-express')({
  directoryUrl: config.directoryUrl,
})
