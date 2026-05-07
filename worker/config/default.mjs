export default {
  cipherPassword: undefined,
  // Optional. When set, the legacy plugins volume at <dataDir>/plugins is read
  // by the v6.0 boot migration. Drops with v7.0.
  dataDir: null,
  // Defaults to <dataDir>/tmp when dataDir is set, else <os.tmpdir>/data-fair-processings.
  tmpDir: null,
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
  maxFailuresCooldown: 12, // in hours
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  privateEventsUrl: null,
  // Internal URL the worker uses for server-to-server calls to registry.
  privateRegistryUrl: 'http://registry:8080',
  secretKeys: {
    events: null,
    // x-secret-key shared with registry. Required for prepare-hook downloads
    // and the v6.0 first-boot migration.
    registry: undefined
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
