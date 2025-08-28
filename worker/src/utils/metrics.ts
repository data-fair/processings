import { Histogram, Gauge } from 'prom-client'
import { servicePromRegistry } from '@data-fair/lib-node/observer.js'
import mongo from '#mongo'

const runsMetrics = new Histogram({
  name: 'df_processings_runs',
  help: 'Number and duration in seconds of processing runs',
  buckets: [0.1, 1, 10, 60, 600],
  labelNames: ['status', 'owner']
})

const initMetrics = async (): Promise<void> => {
  // eslint-disable-next-line no-new
  new Gauge({
    name: 'df_processings_processings_total',
    help: 'Total number of processings',
    registers: [servicePromRegistry],
    async collect () {
      this.set(await mongo.processings.estimatedDocumentCount())
    }
  })
}

export { initMetrics, runsMetrics }
