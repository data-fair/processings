module.exports = {
  mode: 'MODE',
  publicUrl: 'PUBLIC_URL',
  dataDir: 'DATA_DIR',
  tmpDir: 'TMP_DIR',
  port: 'PORT',
  sessionDomain: 'SESSION_DOMAIN',
  directoryUrl: 'DIRECTORY_URL',
  privateDirectoryUrl: 'PRIVATE_DIRECTORY_URL',
  dataFairUrl: 'DATA_FAIR_URL',
  privateDataFairUrl: 'PRIVATE_DATA_FAIR_URL',
  getFromPrivateDataFairUrl: {
    __name: 'GET_FROM_PRIVATE_DATA_FAIR_URL',
    __format: 'json'
  },
  dataFairAPIKey: 'DATA_FAIR_API_KEY',
  dataFairAdminMode: {
    __name: 'DATA_FAIR_ADMIN_MODE',
    __format: 'json'
  },
  notifyUrl: 'NOTIFY_URL',
  privateNotifyUrl: 'PRIVATE_NOTIFY_URL',
  mongo: {
    host: 'MONGO_HOST',
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
  i18n: {
    locales: 'I18N_LOCALES',
    defaultLocale: 'I18N_DEFAULT_LOCALE'
  },
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
  defaultTimeZone: 'DEFAULT_TIME_ZONE',
  npm: {
    httpsProxy: 'NPM_HTTPS_PROXY'
  }
}
