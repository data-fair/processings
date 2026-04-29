import { httpAgent, httpsAgent } from '@data-fair/lib-node/http-agents.js'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import config from '#config'
import type { Processing } from '#api/types'
import type { LogFunctions } from '@data-fair/lib-common-types/processings.js'
import { prepareAxiosError, getHttpErrorMessage as getHttpErrorMessageBase } from './axios-errors.ts'

export { prepareAxiosError } from './axios-errors.ts'

export const getHttpErrorMessage = (err: any) =>
  getHttpErrorMessageBase(err, [config.dataFairUrl, config.privateDataFairUrl])

/**
 * Create an Axios instance.
 */
export const getAxiosInstance = (processing: Processing, log: LogFunctions) => {
  const privateHeaders: Record<string, string> = {
    'x-apiKey': config.dataFairAPIKey,
    // we used to specify User-Agent for all requests, but us creates problems with some external servers
    'User-Agent': `@data-fair/processings (${processing.plugin})`
  }
  if (config.dataFairAdminMode) {
    const account = { ...processing.owner }
    if (account.name) account.name = encodeURIComponent(account.name)
    if (account.departmentName) account.departmentName = encodeURIComponent(account.departmentName)
    privateHeaders['x-account'] = JSON.stringify(account)
  }
  privateHeaders['x-processing'] = JSON.stringify({ _id: processing._id, title: encodeURIComponent(processing.title) })

  const axiosInstance = axios.create({
    // this is necessary to prevent excessive memory usage during large file uploads, see https://github.com/axios/axios/issues/1045
    maxRedirects: 0,
    httpAgent,
    httpsAgent
  })

  // apply default base url and send api key when relevant
  axiosInstance.interceptors.request.use(cfg => {
    if (!cfg.url) throw new Error('missing url in axios request')
    if (!/^https?:\/\//i.test(cfg.url)) {
      if (cfg.url.startsWith('/')) cfg.url = config.dataFairUrl + cfg.url
      else cfg.url = config.dataFairUrl + '/' + cfg.url
    }
    const isDataFairUrl = cfg.url.startsWith(config.dataFairUrl)
    if (isDataFairUrl) Object.assign(cfg.headers, privateHeaders)

    // use private data fair url if specified to prevent leaving internal infrastructure
    // except from GET requests so that they still appear in metrics
    // except if config.getFromPrivateDataFairUrl is set to true, then all requests are sent to the private url
    const usePrivate =
      config.privateDataFairUrl &&
      isDataFairUrl &&
      (config.getFromPrivateDataFairUrl || ['post', 'put', 'delete', 'patch'].includes(cfg.method || ''))
    if (usePrivate) {
      cfg.url = cfg.url.replace(config.dataFairUrl, config.privateDataFairUrl!)
      cfg.headers.host = new URL(config.dataFairUrl).host
    }
    return cfg
  }, error => Promise.reject(error))

  axiosRetry(axiosInstance, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout: true,
    onRetry: (retryCount, _err, requestConfig) => {
      const err = prepareAxiosError(_err)
      const message = getHttpErrorMessage(err) || err.message || err
      log.warning(`tentative ${retryCount} de requête ${requestConfig.method} ${requestConfig.url} : ${message}`)
    }
  })

  return axiosInstance
}
