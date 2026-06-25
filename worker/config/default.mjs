import v8 from 'node:v8'

// Per-task heap default: V8's own heap_size_limit for this host (i.e. what
// the child would get if we omitted --max-old-space-size). Fall back to
// 768MB if V8 reports an implausible value. We always pass
// --max-old-space-size explicitly to children so the limit is visible.
const nodeDefaultTaskMaxHeapMB = (() => {
  try {
    const limit = v8.getHeapStatistics().heap_size_limit
    if (!Number.isFinite(limit) || limit < 64 * 1024 * 1024) return 768
    return Math.floor(limit / (1024 * 1024))
  } catch {
    return 768
  }
})()

export default {
  cipherPassword: undefined,
  // Optional. When set, the legacy plugins volume at <dataDir>/plugins is read
  // by the v6.0 boot migration. Drops with v7.0.
  dataDir: null,
  // Defaults to <dataDir>/tmp when dataDir is set, else <os.tmpdir>/data-fair-processings.
  tmpDir: null,
  dataFairAdminMode: false,
  dataFairAPIKey: null,
  dataFairUrl: 'http://localhost:5600/data-fair',
  defaultLimits: {
    // Maximum time spent running processings
    // -1 for unlimited storage
    processingsSeconds: -1
  },
  privateDataFairUrl: null,
  mails: {
    // transport is a full configuration object for createTransport of nodemailer
    // cf https://nodemailer.com/smtp/
    transport: {
      port: 1025,
      ignoreTLS: true,
      default: 'localhost'
    }
  },
  maxFailures: 10,
  maxFailuresCooldown: 12, // in hours
  mongoUrl: 'mongodb://localhost:27017/data-fair-processings',
  privateEventsUrl: null,
  // Internal URL the worker uses for server-to-server calls to registry.
  privateRegistryUrl: 'http://registry:8080',
  secretKeys: {
    events: null,
    // x-secret-key shared with registry. Required for prepare-hook downloads
    // and the v6.0 first-boot migration.
    registry: undefined
  },
  locks: {
    // in seconds
    ttl: 60
  },
  observer: {
    active: true,
    port: 9090
  },
  runsRetention: 500,
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
    gracePeriod: 20000,
    task: {
      // Max V8 old-generation heap for each task child process, in MB.
      // Passed as --max-old-space-size to the spawned child. Defaults to
      // V8's own default for this host (see nodeDefaultTaskMaxHeapMB above).
      maxHeapMB: nodeDefaultTaskMaxHeapMB,
      // interval at which the child task samples process.memoryUsage()
      // and writes both a df-mem: stdout line (parent updates gauges) and,
      // when processing.debug is true, a debug entry in run.log.
      // Set to 0 to disable periodic sampling (exit-time sample still emitted).
      memorySampleIntervalMs: 10000,
      // Startup sanity check warns when projected concurrency*maxHeapMB heap
      // leaves less than this percent of effective memory as headroom.
      memoryHeadroomWarnPct: 30,
      // Parent-side resource sampler: reads /proc/<pid> at memorySampleIntervalMs
      // for each task child. Becomes the authoritative writer for the per-slot
      // RSS gauge (the in-process df-mem RSS write is suppressed). Auto-disabled
      // at boot on non-Linux platforms.
      externalSamplerEnabled: true
    }
  },
  upgradeRoot: '/app/'
}
