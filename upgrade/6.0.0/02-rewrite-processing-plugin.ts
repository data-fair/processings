import type { UpgradeScript } from '@data-fair/lib-node/upgrade-scripts.js'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import semver from 'semver'
import config from '../../worker/src/config.ts'

/**
 * v6.0 first-boot migration — step 2/2.
 *
 * Rewrite every `processings` document where `plugin` is still a v5-style id
 * string (e.g. `@data-fair-processing-hello-world-1`) into the v6 shape:
 * a single denormalized `pluginId` of the form `{name}@{major}` — registry's
 * artefact id, used to resolve the tarball at run time and to filter/facet
 * lists.
 *
 * The legacy id form lost the original `name` (slashes became dashes) and the
 * full version, so we recover them by reading `dataDir/plugins/{id}/plugin.json`.
 *
 * Fail-fast cases — both throw and abort startup, because continuing would
 * leave the database in a half-migrated state where the worker can no longer
 * load these processings:
 * - the legacy plugins volume isn't mounted but legacy-string processings exist
 * - a processing references a plugin id that has no matching dir on the volume
 *
 * Either case requires operator action: re-mount the volume, restore the
 * missing plugin dir, or delete the orphaned processing manually.
 */
export default {
  description: 'v6.0 — rewrite processing.plugin string into denormalized pluginId',
  async exec (db, debug) {
    const legacyProcessings = await db.collection('processings').find({ plugin: { $type: 'string' } }).toArray()
    if (legacyProcessings.length === 0) {
      debug('no legacy-string processings to migrate')
      return
    }

    if (!config.dataDir) {
      throw new Error(
        `${legacyProcessings.length} legacy-string processings need migration but the legacy plugins volume is not mounted. ` +
        'Set DATA_DIR and mount the dataDir/plugins volume before running this v6.0 boot.'
      )
    }
    const pluginsDir = path.join(config.dataDir, 'plugins')
    if (!existsSync(pluginsDir)) {
      throw new Error(
        `${legacyProcessings.length} legacy-string processings need migration but the legacy plugins volume is not mounted. ` +
        'Mount the dataDir/plugins volume before running this v6.0 boot.'
      )
    }

    for (const p of legacyProcessings) {
      const id = p.plugin as string
      const pluginJsonPath = path.join(pluginsDir, id, 'plugin.json')
      if (!existsSync(pluginJsonPath)) {
        throw new Error(
          `processing ${p._id} (${p.title}) references plugin "${id}" but no matching directory exists on the legacy volume. ` +
          'Either restore the plugin dir or delete the processing manually before retrying the v6.0 boot.'
        )
      }
      const pluginJson = JSON.parse(await readFile(pluginJsonPath, 'utf-8'))
      const { name, version, distTag } = pluginJson as { name: string, version: string, distTag?: string }
      if (!name || !version) {
        throw new Error(`processing ${p._id}: legacy plugin.json at ${pluginJsonPath} missing name or version`)
      }
      if (distTag && distTag !== 'latest') {
        throw new Error(
          `processing ${p._id} references distTag plugin "${id}" — registry has no distTag concept and step 01 skipped publishing it. ` +
          'Republish the plugin under a distinct artefact name in registry, then update this processing manually before retrying.'
        )
      }
      const pluginId = `${name}@${semver.major(version)}`
      debug(`processing ${p._id}: ${id} → pluginId=${pluginId}`)
      await db.collection('processings').updateOne(
        { _id: p._id },
        { $set: { pluginId }, $unset: { plugin: '' } }
      )
    }
  }
} as UpgradeScript
