const apiPort = parseInt(process.env.DEV_API_PORT ?? '8082')
const mongoPort = process.env.MONGO_PORT ?? '27017'
const sdPort = process.env.SD_PORT ?? '8080'
const eventsPort = process.env.EVENTS_PORT ?? '8083'
const observerPort = parseInt(process.env.DEV_API_OBSERVER_PORT ?? '9092')

export default {
  cipherPassword: 'dev',
  dataDir: '../data/development',
  mongoUrl: `mongodb://localhost:${mongoPort}/data-fair-processings-development`,
  observer: {
    port: observerPort
  },
  port: apiPort,
  privateDirectoryUrl: `http://localhost:${sdPort}`,
  privateEventsUrl: `http://localhost:${eventsPort}`,
  secretKeys: {
    identities: 'secret-identities',
    events: 'secret-events'
  }
}
