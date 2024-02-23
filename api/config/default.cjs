module.exports = {
  port: 8082,
  origin: 'http://localhost:5600',
  dataDir: '/data',
  directoryUrl: 'http://localhost:5600/simple-directory',
  privateDirectoryUrl: null,
  dataFairUrl: 'http://localhost:5600/data-fair',
  privateDataFairUrl: null,
  dataFairAPIKey: null,
  notifyUrl: null,
  privateNotifyUrl: null,
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  mails: {
    // transport is a full configuration object for createTransport of nodemailer
    // cf https://nodemailer.com/smtp/
    transport: {
      port: 1025,
      ignoreTLS: true,
      default: 'localhost'
    }
  },
  // secrets that can be used to configure global webhooks
  secretKeys: {
    notifications: null,
    limits: null
  },
  worker: {
    // base interval for polling the database for new resources to work on
    interval: 2000,
    // additional interval when the worker is inactive (no resource found recently)
    // prevent polling too frequently during slow activity periods
    inactiveInterval: 10000,
    // delay of inactivity before we consider the worker as sleeping
    inactivityDelay: 60000,
    // interval of the secondary loop that manages killing tasks
    killInterval: 20000,
    concurrency: 4,
    gracePeriod: 20000
  },
  locks: {
    // in seconds
    ttl: 60
  },
  prometheus: {
    active: true
  },
  defaultLimits: {
    // Maximum time spent running processings
    // -1 for unlimited storage
    processingsSeconds: -1
  },
  defaultTimeZone: 'Europe/Paris'
}
