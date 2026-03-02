export default {
  cipherPassword: 'dev',
  dataDir: '../data/development',
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-development',
  observer: {
    port: 9092
  },
  port: 8082,
  privateDirectoryUrl: 'http://localhost:8080',
  privateEventsUrl: 'http://localhost:8083',
  secretKeys: {
    identities: 'secret-identities',
    events: 'secret-events'
  }
}
