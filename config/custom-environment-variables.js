module.exports = {
  mode: 'MODE',
  publicUrl: 'PUBLIC_URL',
  port: 'PORT',
  sessionDomain: 'SESSION_DOMAIN',
  directoryUrl: 'DIRECTORY_URL',
  dataFairUrl: 'DATA_FAIR_URL',
  dataFairAPIKey: 'DATA_FAIR_API_KEY',
  dataFairAdminMode: {
    __name: 'DATA_FAIR_ADMIN_MODE',
    __format: 'json',
  },
  mongo: {
    host: 'MONGO_HOST',
    db: 'MONGO_DB',
  },
  worker: {
    interval: {
      __name: 'WORKER_INTERVAL',
      __format: 'json',
    },
    concurrency: {
      __name: 'WORKER_CONCURRENCY',
      __format: 'json',
    },
  },
}
