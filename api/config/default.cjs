module.exports = {
  dataDir: '../data',
  tmpDir: null, // will be dataDir + '/tmp' if null
  defaultLimits: {
    // Maximum time spent running processings
    // -1 for unlimited storage
    processingsSeconds: -1
  },
  defaultTimeZone: 'Europe/Paris',
  directoryUrl: 'http://localhost:5600/simple-directory',
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  origin: 'http://localhost:5600',
  port: 8082,
  observer: {
    active: true,
    port: 9090
  }
}
