module.exports = {
  dataDir: './data/test',
  dataFairAdminMode: true,
  dataFairAPIKey: 'd7df4af9-4b19-4ef8-bfe8-16df011961c0', // Nico
  // dataFairUrl: 'https://staging-koumoul.com/s/data-fair',
  // dataFairAPIKey: '2782bd3b-c422-4541-a27a-a03690d9df53',
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings-test',
  prometheus: {
    active: false
  },
  worker: {
    interval: 100,
    killInterval: 2000,
    concurrency: 1,
    gracePeriod: 3000
  }
}
