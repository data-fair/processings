export default {
  cipherPassword: undefined,
  // Optional. When set, the legacy plugins volume at <dataDir>/plugins is read
  // by the v6.0 boot migration. Drops with v7.0.
  dataDir: null,
  // Defaults to <dataDir>/tmp when dataDir is set, else <os.tmpdir>/data-fair-processings.
  tmpDir: null,
  defaultLimits: {
    // Maximum time spent running processings
    // -1 for unlimited storage
    processingsSeconds: -1
  },
  pluginCategories: ['Essentiels', 'Mes plugins', 'Données de références', 'Tests'],
  privateDirectoryUrl: 'http://simple-directory:8080',
  privateEventsUrl: undefined,
  // Internal URL the API uses for server-to-server calls to registry. The UI
  // talks to /registry on the same domain (no public URL is configurable).
  privateRegistryUrl: 'http://registry:8080',
  secretKeys: {
    limits: null,
    events: undefined,
    identities: undefined,
    // x-secret-key shared with registry. Required for save-time validation,
    // prepare-hook downloads, and the v6.0 first-boot migration.
    registry: undefined
  },
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  port: 8080,
  observer: {
    active: true,
    port: 9090
  },
  npm: {
    httpsProxy: null
  }
}
