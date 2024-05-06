module.exports = {
  dataDir: '/app/data',
  tmpDir: null, // will be dataDir + '/tmp' if null
  defaultLimits: {
    // Maximum time spent running processings
    // -1 for unlimited storage
    processingsSeconds: -1
  },
  privateDirectoryUrl: 'http://simple-directory:8080',
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  origin: null,
  port: 8080,
  observer: {
    active: true,
    port: 9090
  },
  npm: {
    httpsProxy: null
  }
}
