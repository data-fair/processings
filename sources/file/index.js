const axios = require('axios')
const path = require('path')
const fs = require('fs')
const pump = require('util').promisify(require('pump'))
const { file } = require('tmp-promise')

exports.run = async function(config) {
  const res = await axios.get(config.url, { responseType: 'stream' })
  const tmpFile = await file()
  await pump(res.data, fs.createWriteStream(tmpFile.path))
  const fileName = res.headers['content-disposition'] ? res.headers['content-disposition'].match(/filename="(.*)"/)[1] : decodeURIComponent(path.parse(config.url).base)
  return { fileName, tmpFile }
}
