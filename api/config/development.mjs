// the dev ports come from .env (copied from dev/default.env by npm run dev-deps); the production names of
// custom-environment-variables.mjs (MONGO_URL, PRIVATE_REGISTRY_URL...) override this file
/** @param {string} name */
const envPort = (name) => {
  const port = process.env[name]
  if (!port) throw new Error(`${name} must be set, run "npm run dev-deps" (it creates .env from dev/default.env)`)
  return port
}
// optional services (events): turned off ('') when their port variable is empty
/** @param {string | undefined} port */
const optionalUrl = (port) => port ? `http://localhost:${port}` : ''

export default {
  cipherPassword: 'dev-cipher-password-0123456789abcdef',
  dataDir: '../data/development',
  mongoUrl: `mongodb://localhost:${envPort('MONGO_PORT')}/data-fair-processings-development`,
  observer: {
    port: parseInt(envPort('DEV_API_OBSERVER_PORT'))
  },
  port: parseInt(envPort('DEV_API_PORT')),
  privateDirectoryUrl: `http://localhost:${envPort('SD_PORT')}`,
  privateEventsUrl: optionalUrl(process.env.EVENTS_PORT),
  privateRegistryUrl: `http://localhost:${envPort('REGISTRY_PORT')}/registry`,
  secretKeys: {
    identities: 'secret-identities',
    events: 'secret-events',
    registry: 'secret-registry-internal'
  }
}
