export default {
  cipherPassword: 'test',
  dataDir: './data/test',
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-test',
  observer: {
    port: 9092
  },
  port: 8082,
  privateDirectoryUrl: 'http://localhost:8080',
  privateEventsUrl: 'http://localhost:8084',
  secretKeys: {
    identities: 'secret-identities',
    events: 'secret-events'
  }
}
