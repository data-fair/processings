const axios = require('axios')
const FormData = require('form-data')
const config = require('config')
const baseUrl = config.dataFairUrl + '/api/v1/datasets'

exports.run = async function(config) {
  const res = await axios.get(config.url, { responseType: 'stream' })
  const fileName = res.headers['content-disposition'].match(/filename="(.*)"/)[1]
  return { fileStream: res.data, fileName, headers: res.headers }
}

exports.initDataset = async function(processing) {
  const res = await axios.get(processing.source.config.url, { responseType: 'stream' })
  const filename = res.headers['content-disposition'].match(/filename="(.*)"/)[1]
  const formData = new FormData()
  // formData.append('owner', JSON.stringify(processing.owner))
  formData.append('file', res.data, { filename, knownLength: Number(res.headers['content-length']) })
  try {
    await axios.post(baseUrl, formData, { headers: { ...formData.getHeaders(), 'content-length': formData.getLengthSync(), 'x-apiKey': config.dataFairAPIKey } })
    // await axios.post(baseUrl, formData, { headers: { ...formData.getHeaders(), 'content-length': formData.getLengthSync(), 'x-apiKey': config.dataFairAPIKey, 'x-organizationId': processing.owner.id } })
  } catch (err) {
    console.log(err.response.data)
  }
}
