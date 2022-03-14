module.exports = {
  mode: 'server_worker', // can be server_worker, server or worker
  port: 5600,
  sessionDomain: null,
  publicUrl: 'http://localhost:5600',
  dataDir: '/data',
  directoryUrl: 'http://localhost:5600/simple-directory',
  dataFairUrl: 'http://localhost:5600/data-fair',
  dataFairAPIKey: null,
  dataFairAdminMode: false,
  notifyUrl: null,
  privateNotifyUrl: null,
  adminRole: 'admin',
  contribRole: 'contrib',
  mongo: {
    host: 'localhost',
    port: 27017,
    db: 'data-fair-processings-' + (process.env.NODE_ENV || 'development')
  },
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
    notifications: null
  },
  worker: {
    // base interval for polling the database for new resources to work on
    interval: 1000,
    // additional interval when the worker is inactive (no resource found recently)
    // prevent polling too frequently during slow activity periods
    inactiveInterval: 4000,
    // delay of inactivity before we consider the worker as sleeping
    inactivityDelay: 60000,
    // interval before releasing the lock on a resource after working on it
    // mostly useful in case of bug where we iterate on the same resource over and over
    releaseInterval: 1000,
    // interval of the secondary loop that manages killing tasks
    killInterval: 10000,
    concurrency: 4,
    gracePeriod: 20000
  },
  locks: {
    // in seconds
    ttl: 60
  },
  i18n: {
    locales: 'fr,en',
    defaultLocale: 'fr'
  },
  proxyNuxt: false
}
