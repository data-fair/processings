export default {
  cipherPassword: 'dev',
  dataDir: '../data/development',
  dataFairAdminMode: true,
  dataFairAPIKey: '', // override in local-development.cjs
  maxFailures: 2,
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-development',
  secretKeys: {
    events: 'secret-events'
  },
  observer: {
    port: 9091
  },
  privateDataFairUrl: 'http://localhost:8081',
  privateEventsUrl: 'http://localhost:8084',
  runsRetention: 5,
  upgradeRoot: '../'
}
