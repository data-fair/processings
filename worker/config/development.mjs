const mongoPort = process.env.MONGO_PORT ?? '27017'
const eventsPort = process.env.EVENTS_PORT ?? '8083'
const dfPort = process.env.DF_PORT ?? '8081'
const registryPort = process.env.REGISTRY_PORT ?? '8085'
const observerPort = parseInt(process.env.DEV_WORKER_OBSERVER_PORT ?? '9091')

export default {
  cipherPassword: 'dev',
  dataDir: '../data/development',
  dataFairAdminMode: true,
  // Dev/test default. The matching settings doc in DF's mongo is seeded by
  // tests/state-setup.ts (idempotent). Real deployments override this via
  // DATA_FAIR_API_KEY or local-development.cjs.
  dataFairAPIKey: 'dev-test-processings-worker-key',
  maxFailures: 2,
  maxFailuresCooldown: 0.05, // 3 minutes
  mongoUrl: `mongodb://localhost:${mongoPort}/data-fair-processings-development`,
  privateRegistryUrl: `http://localhost:${registryPort}/registry`,
  secretKeys: {
    events: 'secret-events',
    registry: 'secret-registry-internal'
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
