const mongoPort = process.env.MONGO_PORT ?? '27017'
const eventsPort = process.env.EVENTS_PORT ?? '8083'
const dfPort = process.env.DF_PORT ?? '8081'
const observerPort = parseInt(process.env.DEV_WORKER_OBSERVER_PORT ?? '9091')

export default {
  cipherPassword: 'dev',
  dataDir: '../data/development',
  dataFairAdminMode: true,
  dataFairAPIKey: '', // override in local-development.cjs
  maxFailures: 2,
  maxFailuresCooldown: 0.05, // 3 minutes
  mongoUrl: `mongodb://localhost:${mongoPort}/data-fair-processings-development`,
  secretKeys: {
    events: 'secret-events'
  },
  observer: {
    port: observerPort
  },
  privateDataFairUrl: `http://localhost:${dfPort}`,
  privateEventsUrl: `http://localhost:${eventsPort}`,
  runsRetention: 5,
  upgradeRoot: '../',
  worker: {
    killInterval: 2000,
    gracePeriod: 3000
  }
}
