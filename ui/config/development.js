module.exports = {
  dataDir: './data/development',
  dataFairAPIKey: 'd7df4af9-4b19-4ef8-bfe8-16df011961c0', // Nico
  // dataFairUrl: 'https://staging-koumoul.com/s/data-fair',
  // dataFairAPIKey: '2782bd3b-c422-4541-a27a-a03690d9df53',
  privateDataFairUrl: 'http://localhost:8081',
  dataFairAdminMode: true,
  notifyUrl: 'http://localhost:5600/notify',
  privateNotifyUrl: 'http://localhost:8088',
  proxyNuxt: true,
  secretKeys: {
    notifications: 'secret-notifications'
  },
  prometheus: {
    active: false,
    port: 9090
  }
}
