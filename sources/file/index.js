const axios = require('axios')

exports.run = async function(config) {
  const res = await axios.get(config.url, { responseType: 'stream' })
  const fileName = res.headers['content-disposition'].match(/filename="(.*)"/)[1]
  return { fileStream: res.data, fileName, headers: res.headers }
}
