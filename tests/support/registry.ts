import fs from 'node:fs'
import path from 'node:path'
import FormData from 'form-data'
import { MongoClient } from 'mongodb'
import { axiosBuilder } from '@data-fair/lib-node/axios.js'

/**
 * Registry test harness — talks to the dev-mode registry container at
 * /registry on the same nginx as processings, with the matching internal
 * secret defined in `docker-compose.yml`.
 *
 * Tests publish their fixture plugin once at the top of a describe block (or
 * via state-setup) and reset registry state between runs by dropping the
 * `data-fair-registry` mongo db directly.
 */

export const registryBaseUrl = `http://${process.env.DEV_HOST}:${process.env.NGINX_PORT1}/registry`
export const registryInternalSecret = 'secret-registry-internal'

export const axiosRegistryInternal = axiosBuilder({
  baseURL: registryBaseUrl,
  headers: { 'x-secret-key': registryInternalSecret }
})

export interface PublishedFixture {
  /** Registry artefact id (`{name}@{major}`) — same value stored on `processing.pluginId`. */
  pluginId: string
}

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
  /** Per-account grants to seed in lieu of, or alongside, public. */
  privateAccess?: { type: 'user' | 'organization', id: string }[]
}

const DEFAULT_TARBALL = path.resolve(import.meta.dirname, '../fixtures/processing-hello-world.tgz')

/**
 * Publish a fixture plugin to registry as the internal service. Patches the
 * artefact metadata so it is visible to the test owner, and returns the
 * pluginId string that `processing.pluginId` now expects.
 *
 * NOTE: the bundled `processing-hello-world.tgz` fixture is the plain
 * `npm pack` output and does NOT include `node_modules`. That is fine for
 * tests that only exercise the API surface (validate, prepare list, picker).
 * Tests that actually trigger a run need a runnable bundle — generate one in
 * a beforeAll (npm install + repack into a tmp tarball) or assert on
 * non-execution behaviour.
 */
export const publishFixturePlugin = async (opts: PublishOptions): Promise<PublishedFixture> => {
  const tarballPath = opts.tarballPath ?? DEFAULT_TARBALL
  const tgz = await fs.promises.readFile(tarballPath)
  const arch = opts.architecture ?? process.arch

  const form = new FormData()
  form.append('architecture', arch)
  form.append('file', tgz, { filename: 'package.tgz', contentType: 'application/gzip' })
  await axiosRegistryInternal.post(
    `/api/v1/artefacts/${encodeURIComponent(opts.name)}/versions`,
    form,
    { headers: form.getHeaders() }
  )

  const major = parseInt(opts.version.split('.')[0], 10)
  const pluginId = `${opts.name}@${major}`

  // Artefacts are keyed by package name; the major suffix only lives on
  // the processings side as a runtime version pin.
  await axiosRegistryInternal.patch(`/api/v1/artefacts/${encodeURIComponent(opts.name)}`, {
    public: opts.isPublic ?? true,
    privateAccess: opts.privateAccess ?? []
  })

  for (const acc of opts.privateAccess ?? []) {
    await axiosRegistryInternal.post(
      '/api/v1/access-grants',
      { account: acc },
      { validateStatus: s => s === 201 || s === 409 }
    )
  }

  return { pluginId }
}

/**
 * Drop the registry mongo db. Called from the global state-setup before each
 * test run to ensure a clean registry across runs. Uses the direct mongo
 * connection because registry has no test-env DELETE endpoint.
 */
export const cleanRegistryDb = async () => {
  const url = `mongodb://localhost:${process.env.MONGO_PORT ?? '27017'}/data-fair-registry`
  const client = new MongoClient(url)
  try {
    await client.connect()
    await client.db().dropDatabase()
  } finally {
    await client.close()
  }
}
