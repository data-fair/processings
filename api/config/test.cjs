module.exports = {
  dataDir: './data/test',
  origin: 'http://localhost:5600',
  port: 8082,
  privateDirectoryUrl: 'http://localhost:8080',
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-test',
  observer: {
    port: 9092
  },
  serveUi: false
}
