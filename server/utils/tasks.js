const path = require('path')
const config = require('config')
const baseUrl = config.dataFairUrl + '/api/v1/datasets'
const axios = require('axios')
const FormData = require('form-data')

exports.run = async (processing, db) => {
  await db.collection('processings').findOneAndUpdate({ id: processing.id }, {
    $set: { status: 'running' }
  })

  let status = 'ok'
  let logMessage = ''
  try {
    const source = require(path.join(__dirname, '../../sources', processing.source.type))
    const result = await source.run(processing.source.config)
    if (result.bulkLines) {
      const results = await axios.post(baseUrl + '/' + processing.dataset.id + '/_bulk_lines', result.bulkLines, { headers: { 'x-apiKey': config.dataFairAPIKey } })
      // TODO : throw error of results.data.ndErrors > 0
      logMessage = `${results.data.nbOk} éléments mis à jour`
    } else if (result.fileStream) {
      const formData = new FormData()
      formData.append('file', result.fileStream, { filename: result.fileName, knownLength: Number(result.headers['content-length']) })
      await axios.post(baseUrl + '/' + processing.dataset.id, formData, { headers: { ...formData.getHeaders(), 'content-length': formData.getLengthSync(), 'x-apiKey': config.dataFairAPIKey } })
    } else {
      throw new Error('Source should return "bulkLines" or "fileStream".')
    }
  } catch (err) {
    console.error('Task error', processing, err)
    logMessage = err.message || err
    status = 'ko'
  }
  await db.collection('processings').findOneAndUpdate({ id: processing.id }, {
    $set: { 'last-execution': { date: new Date(), status }, status: 'stopped' },
    $push: { logs: { $each: [{ date: new Date(), message: logMessage, status }], $slice: -10000 } }
  })
}
