import type { UpgradeScript } from '@data-fair/lib-node/upgrade-scripts.js'

/**
 * TEMPORARY — staging-only revert. Commit, deploy to the affected staging
 * environment once, then revert this commit.
 *
 * One staging environment ran an earlier, now-removed migration that renamed
 * `processing.plugin` to `pluginId` and rewrote its value into the
 * `{name}@{major}` form. The registry keys artefacts by the v5 id, so
 * `processing.plugin` must hold that id again.
 *
 * This script reverses that one-off change: for every processing still
 * carrying a `pluginId`, it writes back `plugin` (the v5 id — `{name}` with
 * `/` flattened to `-`, plus `-{ref}`) and drops `pluginId`.
 *
 * Safe everywhere and idempotent: the upgrade runner re-runs every script in
 * this version directory on each startup. A processing without a `pluginId`
 * field (production, or staging after the first run) is left untouched.
 */

// `{name}@{ref}` (the registry artefact id form the removed migration wrote)
// → v5 id (`{name}` with `/` flattened to `-`, plus `-{ref}`). Split on the
// LAST `@` so a scoped name's leading `@` is preserved.
const pluginIdToPlugin = (pluginId: string): string => {
  const at = pluginId.lastIndexOf('@')
  if (at <= 0) return pluginId.replace('/', '-')
  const name = pluginId.slice(0, at).replace('/', '-')
  return `${name}-${pluginId.slice(at + 1)}`
}

export default {
  description: 'TEMPORARY staging revert — pluginId ({name}@{major}) back to plugin (v5 id)',
  async exec (db, debug) {
    const processings = await db.collection('processings').find({ pluginId: { $type: 'string' } }).toArray()
    if (processings.length === 0) {
      debug('no pluginId-carrying processings — nothing to revert')
      return
    }
    for (const p of processings) {
      const plugin = pluginIdToPlugin(p.pluginId as string)
      debug(`processing ${p._id}: pluginId=${p.pluginId} → plugin=${plugin}`)
      await db.collection('processings').updateOne(
        { _id: p._id },
        { $set: { plugin }, $unset: { pluginId: '' } }
      )
    }
    debug(`reverted ${processings.length} processing(s)`)
  }
} as UpgradeScript
