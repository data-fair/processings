module.exports = {
  cipherPassword: 'dev',
  dataDir: '../data/development',
  dataFairAdminMode: true,
  dataFairAPIKey: '', // override in local-development.cjs
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-development',
  secretKeys: {
    events: 'secret-events'
  },
  privateEventsUrl: 'http://localhost:8088',
  observer: {
    port: 9091
  },
  privateDataFairUrl: 'http://localhost:8081',
  upgradeRoot: '../'
}
