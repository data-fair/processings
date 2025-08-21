export default {
  cipherPassword: undefined,
  dataDir: '/app/data',
  tmpDir: null, // will be dataDir + '/tmp' if null
  dataFairAdminMode: false,
  dataFairAPIKey: null,
  dataFairUrl: 'http://localhost:5600/data-fair',
  defaultLimits: {
    // Maximum time spent running processings
    // -1 for unlimited storage
    processingsSeconds: -1
  },
  privateDataFairUrl: null,
  getFromPrivateDataFairUrl: false,
  mails: {
    // transport is a full configuration object for createTransport of nodemailer
    // cf https://nodemailer.com/smtp/
    transport: {
      port: 1025,
      ignoreTLS: true,
      default: 'localhost'
    }
  },
  maxFailures: 10,
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  privateEventsUrl: null,
  secretKeys: {
    events: null
  },
  locks: {
    // in seconds
    ttl: 60
  },
  observer: {
    active: true,
    port: 9090
  },
  runsRetention: 500,
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
  upgradeRoot: '/app/'
}
