// Webhooks for Simple Directory

import Debug from 'debug'
import { createIdentitiesRouter } from '@data-fair/lib-express/identities/index.js'
import config from '#config'
import mongo from '#mongo'

const debug = Debug('webhooks-simple-directory')

export default createIdentitiesRouter(
  config.secretKeys.identities,
  // onUpdate
  async (identity) => {
    debug('Incoming sd webhook for update', identity)

    const filter = { 'owner.type': identity.type, 'owner.id': identity.id }
    const update = { $set: { 'owner.name': identity.name } }

    await mongo.processings.updateMany(filter, update)
    await mongo.runs.updateMany(filter, update)

    // If the identity has departments, update the department names in processings and runs
    if (identity.departments) {
      for (const department of identity.departments) {
        const filter = { 'owner.type': identity.type, 'owner.id': identity.id, 'owner.department': department.id }
        const update = { $set: { 'owner.departmentName': department.name } }

        await mongo.processings.updateMany(filter, update)
        await mongo.runs.updateMany(filter, update)
      }
    }
  },

  // onDelete
  async (identity) => {
    debug('Incoming sd webhook for delete', identity)
    // TODO: delete all processings and runs for this identity ?
  }
)
