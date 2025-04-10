module.exports = {
  dataDir: '../data/development',
  port: 8082,
  privateDirectoryUrl: 'http://localhost:8080',
  privateEventsUrl: 'http://localhost:8088',
  secretKeys: {
    events: 'secret-events'
  },
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-development',
  observer: {
    port: 9092
  },
  serveUi: false
}
