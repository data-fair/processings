import fs from 'node:fs'
import path from 'node:path'
import FormData from 'form-data'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import { prefix } from './sd-fixtures.ts'

/**
 * Registry test harness — talks to the registry at /registry on the same nginx as processings, and to its private
 * URL with the matching internal secret defined in `docker-compose.yml`.
 *
 * Tests publish their fixture plugin at the top of a describe block or a test. The artefact ids carry the prefix of
 * the test sub-space (`@test_processings_…`): a publication replaces the previous one, registry's own prefixed clean
 * (DELETE /registry/api/test-env?prefix=test_processings_) removes them, and the clean of another sub-space leaves
 * them alone. The suite never cleans anything in the registry itself.
 */

// Through nginx for browser-visible reads (matches what the UI does in dev).
export const registryBaseUrl = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT}/registry`
// Direct to the registry container for internal-secret writes — the registry
// only honours x-secret-key when reqIsInternal is true, which checks for the
// absence of x-forwarded-host. nginx adds that header, so internal calls have
// to skip the proxy.
// PRIVATE_REGISTRY_URL is the production name the api and the worker read too.
export const registryInternalUrl = process.env.PRIVATE_REGISTRY_URL || `http://localhost:${process.env.REGISTRY_PORT}/registry`
export const registryInternalSecret = 'secret-registry-internal'

export const axiosRegistryInternal = axiosBuilder({
  baseURL: registryInternalUrl,
  headers: { 'x-secret-key': registryInternalSecret }
})

export interface PublishedFixture {
  /** Registry artefact id — the value stored on `processing.plugin`. */
  pluginId: string
}

export type Grantee = { type: 'user' | 'organization', id: string }

export interface PublishOptions {
  /** npm package name as it appears in package.json — used in the upload URL. */
  name: string
  /** Full semver of the version being uploaded (e.g. `1.2.3`). */
  version: string
  /** Defaults to the host architecture. */
  architecture?: string
  /** Local path to the .tgz to upload. */
  tarballPath?: string
  /** Set the artefact public (default true) — the cheap path for most tests. */
  isPublic?: boolean
  /** Per-account `privateAccess` entries on the artefact. */
  privateAccess?: Grantee[]
  /**
   * Global access-grants to create (POST /api/v1/access-grants). Registry's
   * canDownload requires a grant for the calling account even when the
   * artefact is public, so the API & worker hitting the registry on behalf
   * of `processing.owner` will 403 unless that owner has a grant.
   *
   * Defaults to the test accounts the lifecycle / permissions / ui specs
   * use as `processing.owner`. Any privateAccess entries are also granted
   * automatically — there is no scenario where a privateAccess entry
   * should not also have a grant.
   */
  grants?: Grantee[]
}

const DEFAULT_GRANTS: Grantee[] = [
  { type: 'user', id: 'test_processings_superadmin' },
  { type: 'organization', id: 'test_processings_org1' },
  { type: 'organization', id: 'test_processings_org2' }
]

/** The artefact id of a fixture plugin: `@test_processings_` then the v5 id form of the package (`@data-fair/x` → `data-fair-x-<major>`). */
export const fixturePluginId = (name: string, major: number | string) => `@${prefix}${name.replace(/^@/, '').replace('/', '-')}-${major}`

const DEFAULT_TARBALL = path.resolve(import.meta.dirname, '../fixtures/processing-hello-world.tgz')

/**
 * Publish a fixture plugin to registry as the internal service. Patches the
 * artefact metadata so it is visible to the test owner, and returns the
 * artefact id string that `processing.plugin` expects.
 *
 * NOTE: the bundled `processing-hello-world.tgz` fixture is the plain
 * `npm pack` output and does NOT include `node_modules`. That is fine for
 * tests that only exercise the API surface (validate, prepare list, picker).
 * Tests that actually trigger a run need a runnable bundle — generate one in
 * a beforeAll (npm install + repack into a tmp tarball) or assert on
 * non-execution behaviour.
 */
export interface PublishBranchOptions {
  /** Registry artefact id (the v5 id form, e.g. `@test_processings_data-fair-processing-hello-world-main`). */
  artefactId: string
  /** Local path to the .tgz to upload. */
  tarballPath?: string
  /** Optional architecture tag. */
  architecture?: string
  /** Set the artefact public (default true). */
  isPublic?: boolean
  /** Per-account `privateAccess` entries on the artefact. */
  privateAccess?: Grantee[]
  /** Global access-grants to create (defaults to the test owner set). */
  grants?: Grantee[]
}

/**
 * Publish a fixture plugin as a branch ref — an artefact whose id carries a
 * non-numeric (branch-name) suffix instead of a major (e.g.
 * `@test_processings_data-fair-processing-hello-world-main`); its tarball slots are replaced on
 * each upload. The returned `pluginId` is the artefact id verbatim.
 */
export const publishFixtureBranchPlugin = async (opts: PublishBranchOptions): Promise<PublishedFixture> => {
  const tarballPath = opts.tarballPath ?? DEFAULT_TARBALL
  const tgz = await fs.promises.readFile(tarballPath)

  const form = new FormData()
  form.append('file', tgz, { filename: 'package.tgz', contentType: 'application/gzip' })
  if (opts.architecture) form.append('architecture', opts.architecture)
  await axiosRegistryInternal.post(
    `/api/v1/artefacts/npm/${encodeURIComponent(opts.artefactId)}`,
    form,
    { headers: form.getHeaders() }
  )

  await axiosRegistryInternal.patch(`/api/v1/artefacts/${encodeURIComponent(opts.artefactId)}`, {
    public: opts.isPublic ?? true,
    privateAccess: opts.privateAccess ?? []
  })

  const grants = opts.grants ?? DEFAULT_GRANTS
  const seen = new Set<string>()
  for (const acc of [...(opts.privateAccess ?? []), ...grants]) {
    const key = `${acc.type}:${acc.id}`
    if (seen.has(key)) continue
    seen.add(key)
    await axiosRegistryInternal.post(
      '/api/v1/access-grants',
      { account: acc },
      { validateStatus: s => s === 201 || s === 409 }
    )
  }

  return { pluginId: opts.artefactId }
}

export const publishFixturePlugin = async (opts: PublishOptions): Promise<PublishedFixture> => {
  const tarballPath = opts.tarballPath ?? DEFAULT_TARBALL
  const tgz = await fs.promises.readFile(tarballPath)
  const arch = opts.architecture ?? process.arch

  const major = parseInt(opts.version.split('.')[0], 10)
  // The artefact id is the v5 id form (`{name}` with `/` flattened to `-`, plus
  // `-{major}`), behind the prefix of the test sub-space — the same value stored on
  // `processing.plugin`. The package inside keeps its name.
  const pluginId = fixturePluginId(opts.name, major)

  const form = new FormData()
  form.append('architecture', arch)
  form.append('file', tgz, { filename: 'package.tgz', contentType: 'application/gzip' })
  await axiosRegistryInternal.post(
    `/api/v1/artefacts/npm/${encodeURIComponent(pluginId)}`,
    form,
    { headers: form.getHeaders() }
  )

  await axiosRegistryInternal.patch(`/api/v1/artefacts/${encodeURIComponent(pluginId)}`, {
    public: opts.isPublic ?? true,
    privateAccess: opts.privateAccess ?? []
  })

  // Always grant the privateAccess set + the default test owners. Dedup so
  // the same account isn't POSTed twice (registry would 409 on the dup, which
  // we accept, but keeping it tidy).
  const grants = opts.grants ?? DEFAULT_GRANTS
  const seen = new Set<string>()
  for (const acc of [...(opts.privateAccess ?? []), ...grants]) {
    const key = `${acc.type}:${acc.id}`
    if (seen.has(key)) continue
    seen.add(key)
    await axiosRegistryInternal.post(
      '/api/v1/access-grants',
      { account: acc },
      { validateStatus: s => s === 201 || s === 409 }
    )
  }

  return { pluginId }
}

/**
 * Remove the suite's own plugins (`@test_processings_…`) from the API and worker tarball cache
 * (<dataDir>/tmp/registry-cache, dev config: ../data/development/tmp/..., one directory per artefact id). Called from
 * `clean()` between tests so a re-published fixture (same ref, possibly different content) is actually
 * re-downloaded — lib-node-registry's cache key is `{artefactId}/{arch}` and would otherwise serve stale extracted
 * files from the previous test. The entries of the other sub-spaces' plugins stay: a run of theirs may be using them.
 */
export const cleanRegistryCache = async () => {
  const repoRoot = path.resolve(import.meta.dirname, '../..')
  const cacheRoot = path.join(repoRoot, 'data/development/tmp/registry-cache')
  const entries = await fs.promises.readdir(cacheRoot).catch(() => [] as string[])
  for (const entry of entries.filter(e => e.startsWith('@' + prefix))) {
    await fs.promises.rm(path.join(cacheRoot, entry), { recursive: true, force: true })
  }
}
