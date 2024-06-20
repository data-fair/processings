/** @type {import('@data-fair/lib/node/upgrade-scripts.js').UpgradeScript} */
export default {
  description: 'Remove all debug logs (some of them are way too verbose)',
  async exec (db, debug) {
    debug(
      // @ts-ignore
      await db.collection('runs').updateMany({}, { $pull: { log: { type: 'debug' } } })
    )
  }
}
