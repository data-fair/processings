// use better DNS lookup than nodejs default and try to reduce number of socket openings

const CacheableLookup = require('cacheable-lookup')
const HttpAgent = require('agentkeepalive')
const HttpsAgent = require('agentkeepalive').HttpsAgent
const { Counter, Gauge } = require('prom-client')

// not very high number of sockets but we don't want to saturate our reverse proxies
// if a higher number is needed the service should probably be scaled anyway
const keepaliveOpts = {
  maxSockets: 8,
  maxFreeSockets: 8,
  timeout: 60000,
  freeSocketTimeout: 30000
}

const httpAgent = new HttpAgent(keepaliveOpts)
const httpsAgent = new HttpsAgent(keepaliveOpts)

const cacheableLookup = new CacheableLookup()
cacheableLookup.install(httpAgent)
cacheableLookup.install(httpsAgent)

// monitor agent statuses
const agents = { http: httpAgent, https: httpsAgent }

const socketsGauge = new Gauge({
  name: 'df_http_agent_sockets',
  help: 'Number of open sockets in the http agent',
  labelNames: ['protocol', 'host']
})
const freeSocketsGauge = new Gauge({
  name: 'df_http_agent_free_sockets',
  help: 'Number of free sockets in the http agent',
  labelNames: ['protocol', 'host']
})
const createSocketCounter = new Counter({
  name: 'df_http_agent_create_socket_total',
  help: 'Total number of sockets created by the http agent',
  labelNames: ['protocol']
})
const requestCounter = new Counter({
  name: 'df_http_agent_request_total',
  help: 'Total number of requests created by the http agent',
  labelNames: ['protocol']
})

const collectMetrics = () => {
  for (const _protocol of ['http', 'https']) {
    const protocol = /** @type {'http' | 'https'} */(_protocol)
    const agentStatus = agents[protocol].getCurrentStatus()
    for (const host in agentStatus.sockets) {
      socketsGauge.set({ protocol, host }, agentStatus.sockets[host])
    }
    for (const host in agentStatus.freeSockets) {
      freeSocketsGauge.set({ protocol, host }, agentStatus.freeSockets[host])
    }
    createSocketCounter.remove({ protocol })
    createSocketCounter.inc({ protocol }, agentStatus.createSocketCount)
    requestCounter.remove({ protocol })
    requestCounter.inc({ protocol }, agentStatus.requestCount)
  }
}

collectMetrics()
setInterval(() => { collectMetrics() }, 60000)

module.exports = { httpAgent, httpsAgent }
