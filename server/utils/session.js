const config = require('config')

module.exports = require('@data-fair/sd-express')({
  directoryUrl: config.directoryUrl
})
