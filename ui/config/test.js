module.exports = {
  dataDir: './data/test',
  directoryUrl: 'http://localhost:8080',
  privateDataFairUrl: 'http://localhost:8081',
  worker: {
    interval: 100,
    concurrency: 1,
    killInterval: 2000,
    gracePeriod: 3000
  },
  prometheus: {
    port: 9092
  }
}
