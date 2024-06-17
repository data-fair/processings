module.exports = {
  dataDir: '../data/development',
  dataFairAdminMode: true,
  dataFairAPIKey: '', // override in local-development.cjs
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-development',
  secretKeys: {
    notifications: 'secret-notifications'
  },
  privateNotifyUrl: 'http://localhost:5600/notify',
  observer: {
    port: 9091
  },
  privateDataFairUrl: 'http://localhost:8081'
}
