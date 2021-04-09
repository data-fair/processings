const config = require('config')
const fs = require('fs-extra')
const nock = require('nock')
const axios = require('axios')
const app = require('../server/app')
const worker = require('../server/worker')
const axiosAuth = require('@koumoul/sd-express').axiosAuth

before('global mocks', () => {
  // fake remote service
  nock('http://registry.npmjs.com')
    .persist()
    .get('/-/v1/search?text=%22data-fair-processings-plugin%22%20hello%20world&size=250').reply(200, require('./resources/npm-response'))
})

before('init globals', async () => {
  const { db, client } = await require('../server/utils/db.js').connect()
  global.db = db
  global.mongoClient = client

  global.ax = {}
  global.ax.builder = async (email, org, opts = {}) => {
    opts.baseURL = config.publicUrl

    let ax
    if (email) ax = await axiosAuth(email, org, opts)
    else ax = axios.create(opts)

    // customize axios errors for shorter stack traces when a request fails in a test
    ax.interceptors.response.use(response => response, error => {
      if (!error.response) return Promise.reject(error)
      delete error.response.request
      return Promise.reject(error.response)
    })
    return ax
  }
  await Promise.all([
    global.ax.builder().then(ax => { global.ax.anonymous = ax }),
    global.ax.builder('dmeadus0@answers.com:passwd').then(ax => { global.ax.dmeadus = ax }),
    global.ax.builder('dmeadus0@answers.com:passwd', 'KWqAGZ4mG').then(ax => { global.ax.dmeadusOrg = ax }),
    global.ax.builder('cdurning2@desdev.cn:passwd').then(ax => { global.ax.cdurning2 = ax }),
    global.ax.builder('superadmin@test.com:superpasswd:adminMode').then(ax => { global.ax.superadmin = ax }),
  ])
})

before('scratch all', async() => {
  await global.db.dropDatabase()
  await fs.remove('./data/test')
})

before('start service', async function () {
  try {
    global.app = await app.start({ db: global.db })
    global.worker = worker.start({ db: global.db })
  } catch (err) {
    console.error('Failed to run the application', err)
    throw err
  }
})

beforeEach('scratch data', async () => {
  await Promise.all([
    global.db.collection('processings').deleteMany({}),
    global.db.collection('runs').deleteMany({}),
  ])
})

after('stop app', async () => {
  await Promise.race([
    new Promise(resolve => setTimeout(resolve, 5000)),
    app.stop(),
  ])
})

after('cleanup globals', async () => {
  await global.mongoClient.close()
})
