import type { UpgradeScript } from '@data-fair/lib-node/upgrade-scripts.js'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { arch as hostArch } from 'node:process'
import * as tar from 'tar'
import axios, { type AxiosInstance } from 'axios'
import config from '../../worker/src/config.ts'

/**
 * v6.0 first-boot migration — step 1/2.
 *
 * For each plugin still living on the legacy `dataDir/plugins` volume:
 *   1. repack the directory (including `node_modules`) and upload the tarball
 *      to registry, tagged with the host architecture
 *   2. push the legacy companion files into registry:
 *      - `-metadata.json` → registry artefact `title.fr`, `description.fr`,
 *        `group.fr` (from v5 `category`), `documentation` via PATCH /artefacts/:id
 *      - `-access.json`   → registry artefact `public` + `privateAccess` via
 *        the same PATCH, and one POST /access-grants per privateAccess entry
 *
 * The mdi `icon` field on `-metadata.json` is intentionally NOT migrated:
 * registry uses thumbnail uploads (binary) for icons; converting an mdi name
 * to an SVG and uploading is left as a manual follow-up because automating
 * that produces middling visuals.
 *
 * Idempotent:
 *  - the publish step probes registry first and skips any (name, version,
 *    arch) tuple that is already published
 *  - PATCH replaces fields wholesale and POST /access-grants accepts 409 when
 *    the grant already exists
 *
 * distTag-suffixed plugin dirs (i.e. installed under a non-`latest` distTag)
 * are skipped with a warning — registry has no distTag concept, so the
 * operator must republish them under a distinct artefact name manually. The
 * processings that reference them will be flagged by step 02.
 *
 * Concurrency: relies on the upgrade-scripts mongo lock; only one worker pod
 * runs this at a time.
 */

type PluginManifest = { name: string, version: string, distTag?: string }

async function listLegacyPluginDirs (pluginsDir: string): Promise<string[]> {
  const entries = await readdir(pluginsDir)
  const dirs: string[] = []
  for (const entry of entries) {
    if (entry.endsWith('.json')) continue
    const full = path.join(pluginsDir, entry)
    try {
      if ((await stat(full)).isDirectory()) dirs.push(entry)
    } catch { /* unreadable, skip */ }
  }
  return dirs
}

async function readPluginManifest (pluginsDir: string, dir: string, debug: (msg: string) => void): Promise<PluginManifest | null> {
  const pluginJsonPath = path.join(pluginsDir, dir, 'plugin.json')
  if (!existsSync(pluginJsonPath)) {
    debug(`${dir}: no plugin.json, skipping`)
    return null
  }
  const pluginJson = JSON.parse(await readFile(pluginJsonPath, 'utf-8')) as PluginManifest
  const { name, version, distTag } = pluginJson
  if (!name || !version) {
    debug(`${dir}: malformed plugin.json (missing name or version), skipping`)
    return null
  }
  if (distTag && distTag !== 'latest') {
    debug(`${dir}: distTag "${distTag}" plugin — registry has no distTag concept, skipping. Operator must republish under a distinct artefact name.`)
    return null
  }
  return pluginJson
}

function createRegistryClient (): AxiosInstance {
  return axios.create({
    baseURL: config.privateRegistryUrl.replace(/\/$/, ''),
    headers: { 'x-secret-key': config.secretKeys.registry }
  })
}

async function publishToRegistry (ax: AxiosInstance, pluginsDir: string, dir: string, manifest: PluginManifest, debug: (msg: string) => void): Promise<void> {
  const { name, version } = manifest

  // Probe: skip if (name, version, arch) already in registry.
  const probe = await ax.get(`/api/v1/artefacts/${encodeURIComponent(name)}/versions/${version}`, {
    params: { architecture: hostArch },
    validateStatus: s => s === 200 || s === 404
  })
  if (probe.status === 200) {
    debug(`${dir}: ${name}@${version} (${hostArch}) already published, skipping`)
    return
  }

  // Repack the dir into a gzipped tarball with the npm `package/` prefix.
  // node_modules is included so lib-node consumers get a runnable bundle.
  const stagingDir = await mkdtemp(path.join(os.tmpdir(), 'processings-migrate-'))
  const tarballPath = path.join(stagingDir, `${dir}.tgz`)
  try {
    await tar.create(
      { gzip: true, cwd: pluginsDir, file: tarballPath, prefix: 'package/' },
      [dir]
    )

    const form = new FormData()
    form.append('architecture', hostArch)
    form.append('file', new Blob([await readFile(tarballPath)]), 'package.tgz')

    debug(`${dir}: uploading ${name}@${version} (${hostArch}) to registry`)
    await ax.post(`/api/v1/artefacts/${encodeURIComponent(name)}/versions`, form, {
      validateStatus: s => s === 201
    }).catch((err) => {
      const status = err?.response?.status
      const body = err?.response?.data
      if (status === 409) {
        throw new Error(`${dir}: artefact ${name} is mirrored or claimed by another uploader (409). Reconcile manually before re-running. Registry said: ${JSON.stringify(body)}`)
      }
      throw err
    })
    debug(`${dir}: published OK`)
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }
}

async function pushMetadataAndAccess (ax: AxiosInstance, pluginsDir: string, dir: string, manifest: PluginManifest, debug: (msg: string) => void): Promise<void> {
  const { name } = manifest

  let metadata: Record<string, unknown> = {}
  const metadataPath = path.join(pluginsDir, `${dir}-metadata.json`)
  if (existsSync(metadataPath)) {
    try { metadata = JSON.parse(await readFile(metadataPath, 'utf-8')) } catch { /* malformed, skip */ }
  }
  let access: { public?: boolean, privateAccess?: { type: string, id: string }[] } = { public: false, privateAccess: [] }
  const accessPath = path.join(pluginsDir, `${dir}-access.json`)
  if (existsSync(accessPath)) {
    try { access = JSON.parse(await readFile(accessPath, 'utf-8')) } catch { /* malformed, treat as private */ }
  }

  const patch: Record<string, unknown> = {
    public: !!access.public,
    privateAccess: access.privateAccess ?? []
  }
  if (typeof metadata.name === 'string') patch.title = { fr: metadata.name }
  if (typeof metadata.description === 'string') patch.description = { fr: metadata.description }
  // v5 category was a free-string used to group plugins on the picker; the
  // registry artefact's own `category` field is the artefact-kind discriminator
  // (always "processing" here), so this maps to the new i18n `group.fr`.
  if (typeof metadata.category === 'string') patch.group = { fr: metadata.category }
  if (typeof metadata.documentation === 'string') patch.documentation = metadata.documentation

  try {
    await ax.patch(`/api/v1/artefacts/${encodeURIComponent(name)}`, patch)
    debug(`${dir}: PATCHed metadata into ${name}`)
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 404) {
      debug(`${dir}: artefact ${name} not in registry — publish must have failed, skipping metadata push`)
      return
    }
    throw err
  }

  // Access grants — one per privateAccess entry. POST returns 201 on
  // create, 409 when already granted (idempotent).
  for (const acc of access.privateAccess ?? []) {
    await ax.post('/api/v1/access-grants', { account: acc }, {
      validateStatus: s => s === 201 || s === 409
    })
  }
  if ((access.privateAccess ?? []).length > 0) {
    debug(`${dir}: ensured ${(access.privateAccess ?? []).length} access-grant(s)`)
  }
}

export default {
  description: 'v6.0 — publish legacy plugins (and their metadata/access) from the volume into registry',
  async exec (_db, debug) {
    if (!config.dataDir) {
      debug('legacy plugins volume not mounted (dataDir unset), skipping')
      return
    }
    const pluginsDir = path.join(config.dataDir, 'plugins')
    if (!existsSync(pluginsDir)) {
      debug('legacy plugins volume not mounted, skipping')
      return
    }

    const dirs = await listLegacyPluginDirs(pluginsDir)
    const ax = createRegistryClient()

    for (const dir of dirs) {
      const manifest = await readPluginManifest(pluginsDir, dir, debug)
      if (!manifest) continue
      await publishToRegistry(ax, pluginsDir, dir, manifest, debug)
      await pushMetadataAndAccess(ax, pluginsDir, dir, manifest, debug)
    }
  }
} as UpgradeScript
