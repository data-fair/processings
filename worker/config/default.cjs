module.exports = {
  origin: 'http://localhost:5600',
  dataFairUrl: 'http://localhost:5600/data-fair',
  dataFairAdminMode: false,
  mongo: {
    host: 'localhost',
    port: 27017,
    db: 'data-fair-processings-' + (process.env.NODE_ENV || 'development'),
    url: null
  },
  locks: {
    // in seconds
    ttl: 60
  },
  worker: {
    // base interval for polling the database for new resources to work on
    interval: 2000,
    // additional interval when the worker is inactive (no resource found recently)
    // prevent polling too frequently during slow activity periods
    inactiveInterval: 10000,
    // delay of inactivity before we consider the worker as sleeping
    inactivityDelay: 60000,
    // interval of the secondary loop that manages killing tasks
    killInterval: 20000,
    concurrency: 4,
    gracePeriod: 20000
  }
}
