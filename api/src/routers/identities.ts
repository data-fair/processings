// Webhooks for Simple Directory

import Debug from 'debug'
import { createIdentitiesRouter } from '@data-fair/lib-express/identities/index.js'
import config from '#config'
import mongo from '#mongo'

const debug = Debug('webhooks-simple-directory')

/** Helper function to update all collections */
const updateAllCollections = async (filter: any, update: any) => {
  await Promise.all([
    mongo.processings.updateMany(filter, update),
    mongo.runs.updateMany(filter, update)
  ])
}

export default createIdentitiesRouter(
  config.secretKeys.identities,
  // onUpdate
  async (identity) => {
    debug('Incoming sd webhook for update', identity)

    // Update owner name
    await updateAllCollections(
      { 'owner.type': identity.type, 'owner.id': identity.id },
      { $set: { 'owner.name': identity.name } }
    )

    if (identity.type === 'user') {
      // Update created/updated name
      await Promise.all([
        updateAllCollections(
          { 'created.id': identity.id },
          { $set: { 'created.name': identity.name } }
        ),
        updateAllCollections(
          { 'updated.id': identity.id },
          { $set: { 'updated.name': identity.name } }
        )
      ])
    }

    // If the identity has departments, update the department names in processings and runs
    if (identity.departments) {
      const departmentUpdates = identity.departments.map(department =>
        updateAllCollections(
          { 'owner.type': identity.type, 'owner.id': identity.id, 'owner.department': department.id },
          { $set: { 'owner.departmentName': department.name } }
        )
      )
      await Promise.all(departmentUpdates)
    }
  },

  // onDelete
  async (identity) => {
    debug('Incoming sd webhook for delete', identity)
    // Delete all processings and runs for this identity
    const filter = { 'owner.type': identity.type, 'owner.id': identity.id }
    await mongo.processings.deleteMany(filter)
    await mongo.runs.deleteMany(filter)
    // When departments are deleted, do nothing
  }
)
