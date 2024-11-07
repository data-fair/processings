import type { Processing, Run } from '#api/types'

import { Mongo } from '@data-fair/lib-node/mongo.js'
import config from '#config'

export class ProcessingsMongo {
  private mongo: Mongo

  get client () {
    return this.mongo.client
  }

  get db () {
    return this.mongo.db
  }

  get processings () {
    return this.mongo.db.collection<Processing>('processings')
  }

  get runs () {
    return this.mongo.db.collection<Run>('runs')
  }

  constructor () {
    this.mongo = new Mongo()
  }

  init = async () => {
    await this.mongo.connect(config.mongoUrl)
  }

  async close () {
    await this.mongo.client.close()
  }
}

const processingsMongo = new ProcessingsMongo()
export default processingsMongo
