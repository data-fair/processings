export default {
  cipherPassword: undefined,
  dataDir: '/app/data',
  tmpDir: null, // will be dataDir + '/tmp' if null
  defaultLimits: {
    // Maximum time spent running processings
    // -1 for unlimited storage
    processingsSeconds: -1
  },
  pluginCategories: ['Essentiels', 'Mes plugins', 'Données de références', 'Tests'],
  privateDirectoryUrl: 'http://simple-directory:8080',
  privateEventsUrl: null,
  secretKeys: {
    limits: null,
    events: null
  },
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  port: 8080,
  observer: {
    active: true,
    port: 9090
  },
  npm: {
    httpsProxy: null
  },
  serveUi: true
}
