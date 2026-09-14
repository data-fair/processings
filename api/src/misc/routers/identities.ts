// Webhooks for Simple Directory: keep the copies of identity data in sync and clean up after a deletion

import Debug from 'debug'
import { createIdentitiesRouter } from '@data-fair/lib-express/identities/index.js'
import config from '#config'
import mongo from '#mongo'
import { deleteProcessing } from '../../runs/service.ts'

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
    const { type, id, name } = identity

    // Update owner name
    await updateAllCollections({ 'owner.type': type, 'owner.id': id }, { $set: { 'owner.name': name } })
    await mongo.limits.updateMany({ type, id }, { $set: { name } })

    if (type === 'user') {
      // Update created/updated name
      await Promise.all([
        updateAllCollections({ 'created.id': id }, { $set: { 'created.name': name } }),
        updateAllCollections({ 'updated.id': id }, { $set: { 'updated.name': name } })
      ])
    }

    if (type === 'organization') {
      // the organization as a partner granted permissions on the processings of others
      await mongo.processings.updateMany(
        { permissions: { $elemMatch: { 'target.type': 'partner', 'target.organization.id': id } } },
        { $set: { 'permissions.$[p].target.organization.name': name } },
        { arrayFilters: [{ 'p.target.type': 'partner', 'p.target.organization.id': id }] }
      )
      // partner permissions are only meaningful inside a partnership: the directory sends the complete
      // list of partners, what is not in it was withdrawn
      if (identity.partners) {
        const partnerIds = identity.partners.map(p => p.id)
        await mongo.processings.updateMany(
          { 'owner.type': 'organization', 'owner.id': id, permissions: { $elemMatch: { 'target.type': 'partner', 'target.organization.id': { $nin: partnerIds } } } },
          { $pull: { permissions: { 'target.type': 'partner', 'target.organization.id': { $nin: partnerIds } } } } as any
        )
      }
    }

    // If the identity has departments, update the department names in processings and runs
    if (identity.departments) {
      const departmentUpdates = identity.departments.map(department =>
        updateAllCollections(
          { 'owner.type': type, 'owner.id': id, 'owner.department': department.id },
          { $set: { 'owner.departmentName': department.name } }
        )
      )
      await Promise.all(departmentUpdates)
    }
  },

  // onDelete
  async (identity) => {
    debug('Incoming sd webhook for delete', identity)
    const { type, id } = identity

    // Delete all processings for this identity, with their runs and their directory
    for await (const processing of mongo.processings.find({ 'owner.type': type, 'owner.id': id })) {
      await mongo.processings.deleteOne({ _id: processing._id })
      await deleteProcessing(mongo, processing)
    }
    await mongo.runs.deleteMany({ 'owner.type': type, 'owner.id': id })
    await mongo.limits.deleteMany({ type, id })

    if (type === 'organization') {
      await mongo.processings.updateMany(
        { permissions: { $elemMatch: { 'target.type': 'partner', 'target.organization.id': id } } },
        { $pull: { permissions: { 'target.type': 'partner', 'target.organization.id': id } } } as any
      )
    }
    if (type === 'user') {
      // what the user authored on the processings of others keeps the trace of the action without the name
      await Promise.all([
        updateAllCollections({ 'created.id': id }, { $unset: { 'created.name': 1 } }),
        updateAllCollections({ 'updated.id': id }, { $unset: { 'updated.name': 1 } })
      ])
    }
    // When departments are deleted, do nothing
  }
)
