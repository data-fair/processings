import type { Processing, Run, Limit } from '#types'

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

  get limits () {
    return this.mongo.db.collection<Limit>('limits')
  }

  constructor () {
    this.mongo = new Mongo()
  }

  init = async () => {
    await this.mongo.connect(config.mongoUrl)
    await this.mongo.configure({
      processings: {
        fulltext: { title: 'text' },
        main: { 'owner.type': 1, 'owner.id': 1 }
      },
      runs: {
        main: { 'owner.type': 1, 'owner.id': 1, 'processing._id': 1, createdAt: -1 }
      },
      limits: {
        fulltext: { id: 'text', name: 'text' },
        'limits-find-current': [{ type: 1, id: 1 }, { unique: true }]
      }
    })
  }

  async close () {
    await this.mongo.client.close()
  }
}

const processingsMongo = new ProcessingsMongo()
export default processingsMongo
