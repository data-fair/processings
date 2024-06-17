module.exports = {
  dataDir: './data/test',
  dataFairAdminMode: true,
  dataFairAPIKey: 'dTpzdXBlcmFkbWluOjZEQ0NXY2ZrSHhVRVQxSzVudmNNg',
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-test',
  observer: {
    port: 9091
  },
  privateDataFairUrl: 'http://localhost:8081',
  worker: {
    interval: 100,
    killInterval: 2000,
    concurrency: 1,
    gracePeriod: 3000
  }
}
