module.exports = {
  dataDir: '../data',
  defaultLimits: {
    // Maximum time spent running processings
    // -1 for unlimited storage
    processingsSeconds: -1
  },
  defaultTimeZone: 'Europe/Paris',
  directoryUrl: 'http://localhost:5600/simple-directory',
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  origin: 'http://localhost:5600',
  port: 8080,
  prometheus: {
    active: true
  }
}
