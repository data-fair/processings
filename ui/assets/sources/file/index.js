import fs from 'fs'
import pump from 'pump'
import { file } from 'tmp-promise'
import { ofetch } from 'ofetch'
import { promisify } from 'util'
import { parse } from 'path'

const pumpPromise = promisify(pump)

/**
 * @param {Record<string, any>} config
 */
export async function run(config) {
  const response = await ofetch.raw(config.url, { responseType: 'arrayBuffer' })
  const tmpFile = await file()

  await pumpPromise(response._data, fs.createWriteStream(tmpFile.path))

  const contentDisposition = response.headers.get('Content-Disposition')
  let fileName
  if (contentDisposition) {
    const matches = contentDisposition.match(/filename="(.*)"/)
    fileName = matches && matches[1] ? matches[1] : decodeURIComponent(parse(config.url).base)
  } else {
    fileName = decodeURIComponent(parse(config.url).base)
  }

  return { fileName, tmpFile }
}
