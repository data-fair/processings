// the dev ports come from .env (copied from dev/default.env by npm run dev-deps); the production names of
// custom-environment-variables.mjs (MONGO_URL, DATA_FAIR_URL, PRIVATE_DATA_FAIR_URL, DATA_FAIR_API_KEY...) override
// this file
/** @param {string} name */
const envPort = (name) => {
  const port = process.env[name]
  if (!port) throw new Error(`${name} must be set, run "npm run dev-deps" (it creates .env from dev/default.env)`)
  return port
}
// optional services (events): turned off ('') when their port variable is empty
/** @param {string | undefined} port */
const optionalUrl = (port) => port ? `http://localhost:${port}` : ''

export default {
  cipherPassword: 'dev-cipher-password-0123456789abcdef',
  dataDir: '../data/development',
  dataFairAdminMode: true,
  // data-fair's public URL, the base of the plugins' relative requests (the default is a fixed port)
  dataFairUrl: `http://${process.env.DEV_HOST ?? 'localhost'}:${envPort('NGINX_PORT')}/data-fair`,
  // Dev/test default. The matching settings doc in DF's mongo is seeded by
  // tests/state-setup.ts (idempotent). Real deployments override this via
  // DATA_FAIR_API_KEY or local-development.cjs.
  dataFairAPIKey: 'dev-test-processings-worker-key',
  mails: {
    transport: {
      host: 'localhost',
      port: parseInt(envPort('MAILDEV_SMTP_PORT')),
      ignoreTLS: true
    }
  },
  maxFailures: 2,
  maxFailuresCooldown: 0.05, // 3 minutes
  mongoUrl: `mongodb://localhost:${envPort('MONGO_PORT')}/data-fair-processings-development`,
  privateRegistryUrl: `http://localhost:${envPort('REGISTRY_PORT')}/registry`,
  secretKeys: {
    events: 'secret-events',
    registry: 'secret-registry-internal'
  },
  observer: {
    port: parseInt(envPort('DEV_WORKER_OBSERVER_PORT'))
  },
  privateDataFairUrl: `http://localhost:${envPort('DF_PORT')}`,
  privateEventsUrl: optionalUrl(process.env.EVENTS_PORT),
  runsRetention: 5,
  upgradeRoot: '../',
  worker: {
    killInterval: 2000,
    gracePeriod: 3000,
    task: {
      // Cap per-task heap in dev so the OOM e2e fixture trips quickly. Prod
      // default is V8's host heap_size_limit in MB — see default.mjs.
      maxHeapMB: 768
    }
  }
}
