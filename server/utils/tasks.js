const path = require('path')
const config = require('config')
const baseUrl = config.dataFairUrl + '/api/v1/datasets'
const axios = require('axios')
const fs = require('fs')
const util = require('util')
const FormData = require('form-data')

function displayBytes(aSize) {
  aSize = Math.abs(parseInt(aSize, 10))
  if (aSize === 0) return '0 octets'
  const def = [[1, 'octets'], [1000, 'ko'], [1000 * 1000, 'Mo'], [1000 * 1000 * 1000, 'Go'], [1000 * 1000 * 1000 * 1000, 'To'], [1000 * 1000 * 1000 * 1000 * 1000, 'Po']]
  for (var i = 0; i < def.length; i++) {
    if (aSize < def[i][0]) return (aSize / def[i - 1][0]).toLocaleString() + ' ' + def[i - 1][1]
  }
}

exports.initDataset = async (processing) => {
  const source = require('../../sources/' + processing.source.type)
  let schema
  try {
    schema = require('../../sources/' + processing.source.type + '/schema.json')
  } catch (err) {
    // nothing to do, just a source without a schema
  }
  if (schema) {
    const dataset = {
      title: processing.newDatasetTitle,
      isRest: true,
      rest: {},
      schema: schema
    }
    if (processing.owner) {
      dataset.owner = { type: 'organization', ...processing.owner }
    }
    const res = await axios.post(baseUrl, dataset, { headers: { 'x-apiKey': config.dataFairAPIKey } })
    return res.data
  } else {
    const result = await source.run(processing.source.config)
    if (result.tmpFile) {
      const formData = new FormData()
      if (processing.newDatasetTitle) formData.append('title', processing.newDatasetTitle)
      if (processing.owner)formData.append('owner', JSON.stringify({ type: 'organization', ...processing.owner }))
      formData.append('file', fs.createReadStream(result.tmpFile.path), { filename: result.fileName })
      formData.getLength = util.promisify(formData.getLength)
      const res = await axios({
        method: 'post',
        url: baseUrl,
        data: formData,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { ...formData.getHeaders(), 'content-length': await formData.getLength(), 'x-apiKey': config.dataFairAPIKey }
      })
      result.tmpFile.cleanup()
      return res.data
    }
  }
}

exports.run = async (processing, db) => {
  await db.collection('processings').findOneAndUpdate({ id: processing.id }, {
    $set: { status: 'running' }
  })

  let status = 'ok'
  let logMessage = ''
  try {
    const source = require(path.join(__dirname, '../../sources', processing.source.type))
    const startTime = process.hrtime()
    const result = await source.run(processing.source.config)
    if (result.bulkLines) {
      const results = await axios.post(baseUrl + '/' + processing.dataset.id + '/_bulk_lines', result.bulkLines, { headers: { 'x-apiKey': config.dataFairAPIKey } })
      // TODO : throw error of results.data.ndErrors > 0
      logMessage = `${results.data.nbOk} éléments mis à jour`
    } else if (result.tmpFile) {
      const formData = new FormData()
      formData.append('file', fs.createReadStream(result.tmpFile.path), { filename: result.fileName })
      formData.getLength = util.promisify(formData.getLength)
      const contentLength = await formData.getLength()
      await axios({
        method: 'post',
        url: baseUrl + '/' + processing.dataset.id,
        data: formData,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { ...formData.getHeaders(), 'content-length': contentLength, 'x-apiKey': config.dataFairAPIKey }
      })
      result.tmpFile.cleanup()
      const elapsed = process.hrtime(startTime)
      const elapsedSeconds = (elapsed[0] + (elapsed[1] / 1e9)).toFixed(2)
      logMessage = `Fichier ${result.fileName} de ${displayBytes(contentLength)} transféré en ${elapsedSeconds} sec.`
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
