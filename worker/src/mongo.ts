import type { Processing, Run } from '#types'

import mongo from '@data-fair/lib-node/mongo.js'
import config from '#config'

export class ProcessingsMongo {
  get client () {
    return mongo.client
  }

  get db () {
    return mongo.db
  }

  get processings () {
    return mongo.db.collection<Processing>('processings')
  }

  get runs () {
    return mongo.db.collection<Run>('runs')
  }

  init = async () => {
    await mongo.connect(config.mongoUrl)
  }
}

const processingsMongo = new ProcessingsMongo()
export default processingsMongo
