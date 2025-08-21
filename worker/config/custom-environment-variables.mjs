export default {
  cipherPassword: 'CIPHER_PASSWORD',
  dataDir: 'DATA_DIR',
  tmpDir: 'TMP_DIR',
  dataFairAPIKey: 'DATA_FAIR_API_KEY',
  dataFairAdminMode: 'DATA_FAIR_ADMIN_MODE',
  dataFairUrl: 'DATA_FAIR_URL',
  defaultLimits: {
    processingsSeconds: 'DEFAULT_LIMITS_PROCESSINGS_SECONDS'
  },
  getFromPrivateDataFairUrl: 'GET_FROM_PRIVATE_DATA_FAIR_URL',
  mails: {
    transport: {
      __name: 'MAILS_TRANSPORT',
      __format: 'json'
    }
  },
  maxFailures: 'MAX_FAILURES_BEFORE_INACTIVE',
  mongoUrl: 'MONGO_URL',
  secretKeys: {
    events: 'SECRET_EVENTS'
  },
  privateEventsUrl: 'PRIVATE_EVENTS_URL',
  locks: {
    ttl: 'LOCKS_TTL'
  },
  observer: {
    active: 'OBSERVER_ACTIVE',
    port: 'OBSERVER_PORT'
  },
  privateDataFairUrl: 'PRIVATE_DATA_FAIR_URL',
  runsRetention: 'RUNS_RETENTION',
  worker: {
    interval: 'WORKER_INTERVAL',
    inactiveInterval: 'WORKER_INACTIVE_INTERVAL',
    inactivityDelay: 'WORKER_INACTIVITY_DELAY',
    killInterval: 'WORKER_KILL_INTERVAL',
    concurrency: 'WORKER_CONCURRENCY',
    gracePeriod: 'WORKER_GRACE_PERIOD'
  }
}
