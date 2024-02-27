module.exports = {
  dataDir: 'DATA_DIR',
  dataFairAPIKey: 'DATA_FAIR_API_KEY',
  dataFairAdminMode: 'DATA_FAIR_ADMIN_MODE',
  dataFairUrl: 'DATA_FAIR_URL',
  defaultLimits: {
    processingsSeconds: 'DEFAULT_LIMITS_PROCESSINGS_SECONDS'
  },
  mails: {
    transport: {
      port: 'MAILS_TRANSPORT_PORT',
      ignoreTLS: 'MAILS_TRANSPORT_IGNORE_TLS',
      default: 'MAILS_TRANSPORT_DEFAULT'
    }
  },
  mongoUrl: 'MONGO_URL',
  notificationsKeys: 'NOTIFICATIONS_KEYS',
  notifyUrl: 'NOTIFY_URL',
  locks: {
    ttl: 'LOCKS_TTL'
  },
  prometheus: {
    active: 'PROMETHEUS_ACTIVE'
  },
  worker: {
    interval: 'WORKER_INTERVAL',
    inactiveInterval: 'WORKER_INACTIVE_INTERVAL',
    inactivityDelay: 'WORKER_INACTIVITY_DELAY',
    killInterval: 'WORKER_KILL_INTERVAL',
    concurrency: 'WORKER_CONCURRENCY',
    gracePeriod: 'WORKER_GRACE_PERIOD'
  }
}
