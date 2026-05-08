import type { UpgradeScript } from '@data-fair/lib-node/upgrade-scripts.js'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { arch as hostArch } from 'node:process'
import * as tar from 'tar'
import axios, { type AxiosInstance } from 'axios'
import * as mdi from '@mdi/js'
import config from '../../worker/src/config.ts'

// Convert a legacy v5 mdi icon name (e.g. `mdi-database`, `mdiDatabase`,
// `database`) into its @mdi/js export name `mdiDatabase`. Returns null if
// the input doesn't resolve to a known icon.
const resolveMdiPath = (icon: string): string | null => {
  const trimmed = icon.trim()
  if (!trimmed) return null
  const stripped = trimmed.replace(/^mdi[-_]?/i, '')
  const camel = 'mdi' + stripped
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  const path = (mdi as unknown as Record<string, unknown>)[camel]
  return typeof path === 'string' ? path : null
}

// Render a 256×256 SVG wrapping an mdi path. Larger than 24 so the registry's
// sharp-based thumbnail resize (target 400 px wide) gets a clean rasterization.
const renderMdiSvg = (mdiPath: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24"><path d="${mdiPath}"/></svg>`

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
 *      - `metadata.icon`  → rendered to a 256×256 SVG using @mdi/js and posted
 *        to the artefact's thumbnail endpoint. Unknown icon names are logged
 *        and skipped (operator can upload a custom thumbnail later).
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

async function listLegacyPluginDirs (pluginsDir: string, debug: (msg: string) => void): Promise<string[]> {
  const entries = await readdir(pluginsDir, { withFileTypes: true })
  const dirs: string[] = []
  for (const entry of entries) {
    if (entry.name.endsWith('.json')) continue
    if (entry.isDirectory()) {
      dirs.push(entry.name)
      continue
    }
    if (entry.isSymbolicLink()) {
      // Follow the link only enough to confirm it points to an actual directory.
      // Broken or non-dir symlinks are skipped — they show up in legacy volumes
      // when a plugin was renamed (e.g. unscoped → @scope) and a stale link
      // was left behind.
      try {
        const s = await stat(path.join(pluginsDir, entry.name))
        if (s.isDirectory()) dirs.push(entry.name)
        else debug(`${entry.name}: symlink to non-directory, skipping`)
      } catch (err: any) {
        debug(`${entry.name}: broken symlink (${err?.code ?? err?.message}), skipping`)
      }
      continue
    }
    debug(`${entry.name}: not a directory, skipping`)
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
    // Pack the dir's *contents* (not the dir itself) so entries land at
    // `package/package.json` etc. — the npm-pack layout the registry's
    // extractManifest requires (`header.name === 'package/package.json'`).
    // Listing children also avoids the `tar` package's `@FILE` convention
    // (any entry starting with `@` would be misread as a file-list path),
    // which would otherwise trip on scoped dir names.
    const pluginDir = path.join(pluginsDir, dir)
    const children = await readdir(pluginDir)
    await tar.create(
      { gzip: true, cwd: pluginDir, file: tarballPath, prefix: 'package/' },
      children
    )

    const form = new FormData()
    form.append('architecture', hostArch)
    // Backfill the artefact category for legacy plugin tarballs whose
    // package.json predates the `registry.category` convention.
    form.append('category', 'processing')
    form.append('file', new Blob([await readFile(tarballPath)]), 'package.tgz')

    debug(`${dir}: uploading ${name}@${version} (${hostArch}) to registry`)
    await ax.post(`/api/v1/artefacts/${encodeURIComponent(name)}/versions`, form, {
      validateStatus: s => s === 201
    }).catch((err) => {
      const status = err?.response?.status
      const body = err?.response?.data
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      if (status === 409) {
        throw new Error(`${dir}: artefact ${name} is mirrored or claimed by another uploader (409). Reconcile manually before re-running. Registry said: ${bodyStr}`)
      }
      // Surface the registry's actual rejection reason — bare status codes
      // ("Request failed with status code 400") are useless for operators.
      if (status) {
        throw new Error(`${dir}: registry rejected upload (${status}): ${bodyStr}`)
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

  let updatedArtefact: { thumbnail?: unknown } | undefined
  try {
    const patchRes = await ax.patch(`/api/v1/artefacts/${encodeURIComponent(name)}`, patch)
    updatedArtefact = patchRes.data as { thumbnail?: unknown }
    debug(`${dir}: PATCHed metadata into ${name}`)
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 404) {
      debug(`${dir}: artefact ${name} not in registry — publish must have failed, skipping metadata push`)
      return
    }
    throw err
  }

  // Render the legacy mdi icon to an SVG and upload it as the artefact
  // thumbnail. Skipped if the artefact already has a thumbnail — re-runs of
  // this migration must not clobber a manually uploaded one. Upload failures
  // are swallowed with a debug log so a single bad icon doesn't fail the run.
  if (typeof metadata.icon === 'string' && metadata.icon.trim()) {
    if (updatedArtefact?.thumbnail) {
      debug(`${dir}: artefact ${name} already has a thumbnail, skipping mdi:${metadata.icon}`)
    } else {
      const mdiPath = resolveMdiPath(metadata.icon)
      if (!mdiPath) {
        debug(`${dir}: unknown mdi icon "${metadata.icon}", skipping thumbnail`)
      } else {
        try {
          const svg = renderMdiSvg(mdiPath)
          const tform = new FormData()
          tform.append('file', new Blob([svg], { type: 'image/svg+xml' }), 'icon.svg')
          await ax.post(`/api/v1/artefacts/${encodeURIComponent(name)}/thumbnail`, tform, {
            validateStatus: s => s === 201
          })
          debug(`${dir}: uploaded thumbnail from mdi:${metadata.icon}`)
        } catch (err: any) {
          const status = err?.response?.status
          const body = err?.response?.data
          const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
          debug(`${dir}: thumbnail upload failed (${status ?? 'no-response'}: ${bodyStr ?? err?.message}) — leaving artefact without icon`)
        }
      }
    }
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

    const dirs = await listLegacyPluginDirs(pluginsDir, debug)
    const ax = createRegistryClient()

    // Track per-dir failures so the operator sees them surfaced together at the
    // end. A single broken plugin dir (stale symlink, corrupted node_modules,
    // partial install) shouldn't block migration of the rest.
    const failures: { dir: string, error: string }[] = []
    for (const dir of dirs) {
      try {
        const manifest = await readPluginManifest(pluginsDir, dir, debug)
        if (!manifest) continue
        await publishToRegistry(ax, pluginsDir, dir, manifest, debug)
        await pushMetadataAndAccess(ax, pluginsDir, dir, manifest, debug)
      } catch (err: any) {
        const msg = err?.code ? `${err.code}: ${err.message}` : (err?.message ?? String(err))
        debug(`${dir}: failed to migrate (${msg}) — leaving on volume for manual reconciliation`)
        failures.push({ dir, error: msg })
      }
    }
    if (failures.length > 0) {
      debug(`${failures.length} plugin dir(s) failed migration: ${failures.map(f => f.dir).join(', ')}. Inspect logs above and reconcile manually before the v7.0 upgrade.`)
    }
  }
} as UpgradeScript
