/** @type {import('@data-fair/lib/node/upgrade-scripts.js').UpgradeScript} */
export default {
  description: 'Remove null values in owner.department',
  async exec (db, debug) {
    debug(
      await db.collection('processings').updateMany(
        { 'owner.department': { $type: 10 } },
        { $unset: { 'owner.department': '' } }
      )
    )
  }
}
