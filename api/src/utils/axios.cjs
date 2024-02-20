// prepare an axios instance with improved error management

const axios = require('axios')
const { httpAgent, httpsAgent } = require('./http-agents.cjs')

module.exports = axios.create({ httpAgent, httpsAgent })

module.exports.interceptors.response.use(response => response, error => {
  const response = error.response ?? error.request?.res ?? error.res
  if (!response) return Promise.reject(error)
  delete response.request
  delete response.headers
  response.config = { method: response.config.method, url: response.config.url, data: response.config.data }
  if (response.config.data && response.config.data._writableState) delete response.config.data
  if (response.data && response.data._readableState) delete response.data
  response.message = `${response.status} - ${response.data || response.statusText}`
  return Promise.reject(response)
})
