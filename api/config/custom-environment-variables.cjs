module.exports = {
  mode: 'MODE',
  publicUrl: 'PUBLIC_URL',
  port: 'PORT',
  directoryUrl: 'DIRECTORY_URL',
  privateDirectoryUrl: 'PRIVATE_DIRECTORY_URL',
  dataFairUrl: 'DATA_FAIR_URL',
  privateDataFairUrl: 'PRIVATE_DATA_FAIR_URL',
  dataFairAPIKey: 'DATA_FAIR_API_KEY',
  notifyUrl: 'NOTIFY_URL',
  privateNotifyUrl: 'PRIVATE_NOTIFY_URL',
  mongo: {
    host: 'MONGO_HOST',
    port: 'MONGO_PORT',
    db: 'MONGO_DB',
    url: 'MONGO_URL'
  },
  mails: {
    transport: {
      __name: 'MAILS_TRANSPORT',
      __format: 'json'
    }
  },
  secretKeys: {
    notifications: 'SECRET_NOTIFICATIONS',
    limits: 'SECRET_LIMITS'
  },
  worker: {
    interval: {
      __name: 'WORKER_INTERVAL',
      __format: 'json'
    },
    concurrency: {
      __name: 'WORKER_CONCURRENCY',
      __format: 'json'
    }
  },
  locks: { ttl: 'LOCKS_TTL' },
  prometheus: {
    active: {
      __name: 'PROMETHEUS_ACTIVE',
      __format: 'json'
    },
    port: 'PROMETHEUS_PORT'
  },
  defaultLimits: {
    processingsSeconds: {
      __name: 'DEFAULT_LIMITS_PROCESSINGS_SECONDS',
      __format: 'json'
    }
  },
  defaultTimeZone: 'DEFAULT_TIME_ZONE'
}