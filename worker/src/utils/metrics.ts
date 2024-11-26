import type { Db } from 'mongodb'
import { Histogram, Gauge } from 'prom-client'
import { servicePromRegistry } from '@data-fair/lib-node/observer.js'

const runsMetrics = new Histogram({
  name: 'df_processings_runs',
  help: 'Number and duration in seconds of processing runs',
  buckets: [0.1, 1, 10, 60, 600],
  labelNames: ['status', 'owner']
})

const initMetrics = async (db: Db): Promise<void> => {
  // eslint-disable-next-line no-new
  new Gauge({
    name: 'df_processings_processings_total',
    help: 'Total number of processings',
    registers: [servicePromRegistry],
    async collect () {
      this.set(await db.collection('processings').estimatedDocumentCount())
    }
  })
}

export { initMetrics, runsMetrics }
