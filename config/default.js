module.exports = {
  port: 5600,
  sessionDomain: null,
  publicUrl: 'http://localhost:5600',
  dataDir: '/data',
  directoryUrl: 'http://localhost:5600/simple-directory',
  dataFairUrl: 'http://localhost:5600/data-fair',
  datasetsUrlTemplate: 'http://localhost:5600/data-fair/dataset/{id}/description',
  dataFairAPIKey: null,
  dataFairAdminMode: false,
  mongo: {
    host: 'localhost',
    port: 27017,
    db: 'data-fair-processings-' + (process.env.NODE_ENV || 'development'),
  },
}
