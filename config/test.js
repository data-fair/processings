module.exports = {
  dataDir: './data/test',
  directoryUrl: 'http://localhost:8080',
  dataFairUrl: 'http://localhost:8081',
  worker: {
    interval: 100,
    concurrency: 1,
    killInterval: 2000,
    gracePeriod: 3000
  }
}
