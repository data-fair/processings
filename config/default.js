module.exports = {
  port: 5600,
  sessionDomain: null,
  publicUrl: 'http://localhost:5600',
  directoryUrl: 'http://localhost:5600/simple-directory',
  dataFairUrl: 'http://localhost:8080',
  dataFairAPIKey: null,
  dataFairAdminMode: false,
  mongo: {
    host: 'localhost',
    port: 27017,
    db: 'incremental-datasets-' + (process.env.NODE_ENV || 'development')
  }
}
