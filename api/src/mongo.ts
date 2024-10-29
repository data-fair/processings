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

  get limits () {
    return mongo.db.collection('limits')
  }

  init = async () => {
    await mongo.connect(config.mongoUrl)
    await mongo.configure({
      processings: {
        fulltext: { title: 'text' },
        main: { 'owner.type': 1, 'owner.id': 1 }
      },
      runs: {
        main: { 'owner.type': 1, 'owner.id': 1, 'processing._id': 1, createdAt: -1 }
      }
    })
  }
}

const processingsMongo = new ProcessingsMongo()
export default processingsMongo
