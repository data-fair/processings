# Processings v6.0 — registry integration

## Context

`@data-fair/processings` today stores plugin code on a persistent volume at `dataDir/plugins/{plugin-id}` and tracks per-plugin state in three sibling JSON files (`-access.json`, `-config.json`, `-metadata.json`). Installation goes through a superadmin-only `POST /api/v1/plugins` that runs `npm pack` + `npm install --omit=dev`. The API and worker both `import()` directly from the volume.

We want to move plugin code, schemas, metadata and access fully into `@data-fair/registry` (sibling repo at `/home/alban/data-fair/registry`), so processings becomes stateless w.r.t. plugin content. The worker and API will use registry's `lib-node` to download plugin tarballs into a per-container ephemeral cache (k8s `emptyDir`) on demand.

This is a major version (v6.0) and a transition release: the legacy plugins volume is still optionally mounted, but only as a *read-only* source for two things:

1. The first-boot migration — it reads each plugin dir, re-tars it (with `node_modules`) and uploads to registry, plus pushes metadata and access-grants.
2. Legacy plugin-config (the editable global per-instance plugin config) — the worker keeps reading `{id}-config.json` from the volume in v6.0 only. The concept is deprecated; new plugin versions must not depend on it. A future major (v7.0) drops both the volume mount and the read-only support.

Registry is the single source of truth for plugin code, schemas, public/private flag, access-grants, metadata. Processings keeps *no* mongo collection mirroring plugin state.

## Key decisions

- Registry holds plugin code + schemas + metadata + access. Processings no longer has an "installed plugins" set.
- Tarballs in registry are pre-installed (include prod `node_modules`) and tagged with the CPU architecture they were built for. lib-node extracts directly; no runtime npm install.
- Architecture-aware retrieval is incomplete in registry today — must be finished. Resolver and tarball download accept an `architecture` query; lib-node detects `process.arch` and sends it; a tarball with no architecture acts as a noarch fallback.
- Worker auth: `x-secret-key` plus `x-account` JSON header. Registry validates the secret AND enforces grants for the supplied account. Without `x-account`, today's full-bypass behaviour is preserved.
- The `POST/GET/PUT/DELETE /api/v1/plugins` endpoints, the on-disk plugin dir at runtime, and the UI plugin admin page are dropped entirely. The UI's "create processing" plugin picker calls registry directly.
- API still calls each plugin's `prepare(context)` hook on save — it uses lib-node to ensure the plugin into its own emptyDir cache, separate from the worker's cache.
- distTag-suffixed legacy plugins (e.g. `foo-1-beta`): skip with warning at migration time. Registry has no distTag concept and mangling artefact names is rejected as ugly; operator handles them manually.
- UI → registry: direct browser call. Registry is deployed on the same domain at the `/registry` path, so no CORS handling is needed; the SimpleDirectory session cookie is already valid for the registry origin.
- Plugin schemas (`processingConfigSchema`) are read by processings from the cached plugin tarball's `package.json#registry`, not from registry artefact metadata. Registry remains a generic artefact store. Registry still extracts the field today for its own UI; that extraction stays for now and may be cleaned up in a separate later effort.
- Documentation: add to registry artefact schema. Icon: convert mdi name to SVG and upload to artefact thumbnail.
- URL config: only `privateRegistryUrl` (internal, used by API/worker server-to-server) is configurable. The UI assumes registry is mounted at `/registry` on the same domain as processings.
- Orphan processings (legacy `processing.plugin` string with no matching plugin dir on volume) → migration fails fast. We don't want a half-migrated database.
- Plugin picker UI in v6.0: flat list with search, no sub-categories. Revisit later.

## Plan

### A. Registry-side changes (`/home/alban/data-fair/registry`)

#### A.1 Architecture-aware version resolution
- `api/src/artefacts/service-pure.ts` — extend `resolveVersionQuery(artefactId, versionParam, architecture?)` to return `{ primaryFilter, fallbackFilter?, sort }`. When `architecture` is set, primary filter adds `{ architecture }`; fallback filter adds `{ architecture: { $exists: false } }`.
- `api/src/artefacts/router.ts` — in `GET /artefacts/:id/versions/:version` and `GET /artefacts/:id/versions/:version/tarball`, read `req.query.architecture`, run `findOne(primary)` then `findOne(fallback)` if missing; return 404 if neither matches.
- Note: when patch 5 exists only as `arm64` and patch 4 as both archs, an `x64` worker resolving `1.2` gets patch 4. That's "latest patch available on my arch", not "latest patch overall". Document explicitly.

#### A.2 lib-node (`lib-node/index.ts`)
- Add `architecture?: string` (default `process.arch`) and `account?: { type: 'user'|'organization', id: string, department?: string }` to `EnsureArtefactOpts`.
- Pass `architecture` as query param on both the resolve call and the tarball call.
- When `account` is set, send `x-account: JSON.stringify(account)` alongside `x-secret-key`.
- Cache key includes architecture: `extractDir = join(artefactDir, ${resolvedVersion}${arch ? '_' + arch : ''})`. `.current-version.json` becomes `{ version, architecture? }` (additive, backwards-compatible).
- Update `lib-node/index.d.ts` and JSDoc to describe noarch fallback semantics.

#### A.3 Internal-secret + account context (`api/src/auth.ts` and `api/src/artefacts/router.ts`)
- New helper `tryInternalSecretWithAccount(req)` — returns `null`, `{ account: null }` (full bypass), or `{ account }` (validated).
- `x-account` parses to `{ type, id, department? }`; invalid JSON/type → 400.
- Replace internal-secret usage in `GET /artefacts`, `GET /artefacts/:id`, the resolver, the tarball endpoint, and `GET /artefacts/:id/download`:
  - `account === null` → preserve today's bypass (filter: `{}`).
  - `account` present → call `artefactAccessFilterForAccount(account, { requireGrant: false })` and apply that filter.
- `api/src/access.ts` — add `requireGrant` option to `artefactAccessFilterForAccount`. Internal-with-account flows pass `false` (an account can be enforced without holding a global grant, as long as the artefact is public or has explicit privateAccess for that account). Read-key flow keeps `requireGrant: true`.
- `PATCH /artefacts/:id` and `POST /access-grants` — currently require `session.reqAdminMode(req)`. Extend both to also accept `x-secret-key` (same temporary internal-secret pattern as the upload endpoint). The migration in section D needs this.

#### A.4 Documentation field on artefact schema
- `api/types/artefact/schema.js` — add optional `documentation: { type: 'string', format: 'uri' }`.
- Surface it in `GET /artefacts/:id` responses (no extra work — present-in-doc auto-passes through).
- Optional follow-up: extract `documentation` from `package.json#registry.documentation` during upload (mirrors how `processingConfigSchema` is extracted today).

#### A.5 Tests
- `tests/features/artefacts/*.unit.spec.ts` — new cases for `resolveVersionQuery` arch primary/fallback.
- `tests/features/artefacts/*.api.spec.ts`:
  - resolves to arch-specific tarball when one exists
  - falls back to noarch tarball when no arch match exists
  - 404 if no arch match and no noarch
  - download with `x-account` enforces that account's grants
  - download without `x-account` preserves bypass
  - `PATCH /artefacts/:id` works with `x-secret-key`

### B. Processings — runtime (`/home/alban/data-fair/processings_feat-registry`)

#### B.1 Config keys
- `api/config/type/schema.json` and `worker/config/type/schema.json` — top-level `privateRegistryUrl` (required), `secretKeys.registry` (alongside other internal secrets). `dataDir` is optional (defaults to null) and, when set, implies the legacy plugins volume is mounted (no separate flag).
- `api/config/default.mjs`, `worker/config/default.mjs` — sensible defaults. `tmpDir` defaults to `${dataDir}/tmp` if `dataDir` is set, else `${os.tmpdir()}/data-fair-processings`. The registry tarball cache is always derived as `${tmpDir}/registry-cache` (mount `tmpDir` as emptyDir in k8s if you want the cache ephemeral).
- `api/config/custom-environment-variables.mjs`, `worker/config/custom-environment-variables.mjs` — env var names: `PRIVATE_REGISTRY_URL`, `SECRET_REGISTRY`, `DATA_DIR`, `TMP_DIR`.
- `api/src/config.ts` — UI hits `/registry` directly (same-domain assumption), so `uiConfig` no longer carries a registry URL.

#### B.2 Drop plugin admin
Files to delete entirely:
- `api/src/plugins/router.ts`
- `api/src/plugins-registry/router.ts`
- `api/types/plugin/`
- `api/doc/plugin/` (if present)
- `ui/src/pages/admin/plugins.vue` (and route entry)
- `tests/features/plugins/install.api.spec.ts`
- `tests/features/plugins/registry.api.spec.ts`

Edits:
- `api/src/app.ts` — remove the two `app.use('/api/v1/plugins-registry', ...)` and `app.use('/api/v1/plugins', ...)` mounts and their imports.
- `ui/src/App.vue` (or wherever the admin nav is built) — drop the `/admin/plugins` link.
- Search `grep -rn 'api/v1/plugins' api/ ui/` and remove every remaining reference.

#### B.3 Worker — replace dynamic import (`worker/src/task/task.ts` ~ lines 88–134)
Replace the on-disk plugin location block with:

```ts
import { ensureArtefact } from '@data-fair/registry/lib-node'

const ensured = await ensureArtefact({
  registryUrl: config.privateRegistryUrl,
  secretKey: config.secretKeys.registry,
  artefactId: `${processing.plugin.name}@${semver.major(processing.plugin.version)}`,
  version: processing.plugin.version,
  cacheDir: registryCacheDir,
  architecture: process.arch,
  account: processing.owner
})

let pluginConfig: Record<string, unknown> = {}
if (config.dataDir) {
  const legacyConfigPath = path.join(config.dataDir, 'plugins', legacyIdFor(processing.plugin) + '-config.json')
  if (await fs.pathExists(legacyConfigPath)) pluginConfig = await fs.readJson(legacyConfigPath)
}

const pluginModule = await import(path.join(ensured.path, 'index.js'))
```

`legacyIdFor({name, version})` reproduces the v5 id (`name.replace('/', '-') + '-' + semver.major(version)`). It lives in a small util module used by the migration scripts and the legacy plugin-config lookup; deleted in v7.0.

The rest of `task.ts` (cwd, processingConfig, secrets, axios, ws, log) stays unchanged.

#### B.4 API — validation + prepare (`api/src/processings/router.ts`)

Both validation and `prepare` share one path: `ensureArtefact` into `registryCacheDir`, then read `${ensured.path}/package.json#registry.processingConfigSchema` for ajv. Calls to registry use `x-secret-key` + `x-account: processing.owner`, so a 403 from `ensureArtefact` becomes a 403 from the save endpoint — replaces the explicit access check at L300–309.

A small helper:

```ts
async function ensurePluginAndReadSchema(processing) {
  const ensured = await ensureArtefact({
    registryUrl: config.privateRegistryUrl,
    secretKey: config.secretKeys.registry,
    artefactId: `${processing.plugin.name}@${semver.major(processing.plugin.version)}`,
    version: processing.plugin.version,
    cacheDir: registryCacheDir,
    architecture: process.arch,
    account: processing.owner
  })
  const pkg = await fs.readJson(path.join(ensured.path, 'package.json'))
  return { ensured, processingConfigSchema: pkg.registry?.processingConfigSchema }
}
```

- `validateFullProcessing` calls `ensurePluginAndReadSchema`, runs ajv on `processing.config`. The cache means the second call within the same save (for `prepare`) doesn't redownload.
- `prepareProcessing` reuses the `ensured` reference if already obtained, otherwise calls the helper. Then `import(path.join(ensured.path, 'index.js') + '?imported=' + Date.now())` (cache-busting because prepare may be invoked multiple times in the same process). Calls `plugin.prepare(context)` if exported.
- `GET /api/v1/processings/{id}/api-docs.json` (router.ts ~L435) calls `ensurePluginAndReadSchema` and inlines the schema into the OpenAPI definition.

#### B.5 Plugin-config legacy read
Single read site, in worker `task.ts` (B.3). API never reads plugin-config. When `dataDir` is unset, `pluginConfig = {}`. Worker logs a one-line deprecation warning when injecting a non-empty `pluginConfig`, so we can monitor stragglers.

#### B.6 `processing.plugin` schema change
- `api/types/processing/schema.js` — change the `plugin` property:
  ```js
  plugin: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'version'],
    readOnly: true,
    properties: {
      name: { type: 'string' },
      version: { type: 'string', description: 'Semver pin like "1", "1.2", or exact "1.2.3"' }
    }
  }
  ```
- Aggregations in `router.ts` that group by `$plugin` (~L189, ~L206) — switch to a denormalized helper `pluginId` field updated on every save (`${plugin.name}@${semver.major(plugin.version)}`), or use a `$concat` in the aggregation.
- Mongo migration: see D.4.

### C. UI changes

#### C.1 Plugin picker
`ui/src/pages/processings/new.vue` (or wherever the picker lives — `grep -rn 'plugins?privateAccess' ui/src`):

```ts
const installedPluginsFetch = useFetch<{ results: Artefact[], count: number }>(
  `${$uiConfig.registryUrl}/api/v1/artefacts?category=processing&size=100`
)
```

Field mapping when displaying / when constructing `processing.plugin`:
- `plugin.metadata.name` ← `artefact.title?.fr ?? artefact.title?.en ?? artefact.name`
- `plugin.metadata.icon` → fetch from `${$uiConfig.registryUrl}/api/v1/artefacts/${artefact._id}/thumbnail/${artefact.thumbnail.id}`
- `processing.plugin` → `{ name: artefact.name, version: String(artefact.majorVersion) }`

For v6.0, list plugins flat with a search box. No sub-categories.

Same-domain deployment: registry sits on the same host at `/registry`, so the browser call to `/registry/api/v1/artefacts?...` is same-origin. No CORS configuration is required and the existing SimpleDirectory session cookie is naturally sent. The dev environment must mirror this — see E.1.

#### C.2 Drop admin pages and nav
- Delete `ui/src/pages/admin/plugins.vue` and matching route in `ui/src/router/`.
- Drop the `/admin/plugins` nav entry.
- Search `grep -rn 'plugins' ui/src/components/admin/ ui/src/App.vue ui/src/i18n/` and clean up.

### D. First-boot migration (`upgrade/6.0.0/`)

Lives in the existing upgrade-scripts framework — `worker/src/worker.ts` already calls `await upgradeScripts(mongo.db, locks, config.upgradeRoot)` at startup, which provides the mongo lock against multi-pod races. Three scripts, run in order:

#### D.1 `01-publish-plugins-to-registry.ts`
- If `dataDir/plugins` doesn't exist → log "no legacy volume, skipping" and return.
- For each plugin dir (skip files matching `*.json`, skip distTag dirs ending `-{distTag}` where `distTag !== 'latest'` — log a warning and continue):
  - Read `dataDir/plugins/{id}/plugin.json` → `{ name, version }`.
  - Probe registry: `GET /api/v1/artefacts/${encodeURIComponent(name + '@' + semver.major(version))}/versions/${version}?architecture=${process.arch}`. If 200 → already published, skip.
  - Re-tar the directory (with `node_modules`) using `tar.create({ gzip: true, cwd: dataDir/plugins, prefix: 'package/' }, [id])`.
  - Multipart POST to `${registry.privateUrl}/api/v1/artefacts/${encodeURIComponent(name)}/versions` with `architecture=${process.arch}` and `x-secret-key`.
  - On 409 (artefact origin set / mirrored from elsewhere): fail fast with an operator-actionable error.

#### D.2 `02-push-metadata-and-access.ts`
For each plugin dir:
- Read `{id}-metadata.json` (if present) and `{id}-access.json` (if present, default `{public: false, privateAccess: []}`).
- PATCH `${registry.privateUrl}/api/v1/artefacts/${encodeURIComponent(name + '@' + semver.major(version))}` with `x-secret-key`:
  - `public: !!access.public`
  - `privateAccess: access.privateAccess`
  - `title: { fr: metadata.name }` if present
  - `description: { fr: metadata.description }` if present (note: registry localised description; mapping to `fr` matches today's UI)
  - `documentation: metadata.documentation` if present (registry artefact schema is being extended in A.4)
- If `metadata.icon` is an mdi name string: render to SVG (use `@mdi/js` to fetch the path, wrap in an `<svg>` template) and POST it to the artefact's thumbnail endpoint. If the icon name is invalid, skip with warning.
- For each `access.privateAccess` entry: `POST /api/v1/access-grants` with `{ account: acc }`. Accept 201 or 409 (already exists, idempotent).

#### D.3 `03-rewrite-processing-plugin.ts`
- Find `processings` where `plugin` is type string.
- For each: parse `{id} = plugin`, find the matching legacy plugin dir, read its `plugin.json` to recover `name` and `version`, then `db.collection('processings').updateOne({_id}, { $set: { plugin: { name, version: String(semver.major(version)) }, pluginId: ... } })`.
- If a processing's plugin id has no matching dir on the volume → fail-fast (throw). Operator must restore the volume or delete the orphaned processing manually.
- If `dataDir` is unset AND there are any legacy-string processings → fail-fast at startup with a clear message ("set DATA_DIR and re-mount the plugins volume for the v6.0 boot").

### E. Dev / test environment

#### E.1 docker-compose
Add to `docker-compose.yml`:

```yaml
registry:
  profiles: [dev]
  image: ghcr.io/data-fair/registry:main
  network_mode: host
  depends_on: [mongo, simple-directory]
  environment:
    - PORT=${REGISTRY_PORT}
    - MONGO_URL=mongodb://localhost:${MONGO_PORT}/data-fair-registry
    - PRIVATE_DIRECTORY_URL=http://localhost:${SD_PORT}
    - PUBLIC_URL=http://${DEV_HOST}:${NGINX_PORT1}/registry
    - SECRET_INTERNAL_SERVICES=secret-registry-internal
    - OBSERVER_ACTIVE=false
    - STORAGE_TYPE=fs
  volumes:
    - registry-data:/app/data

volumes:
  registry-data:
```

- Add `REGISTRY_PORT` to `dev/init-env.sh` and `.env`.
- Add `/registry/` location in `dev/resources/nginx.conf.template` proxying to `localhost:${REGISTRY_PORT}`.
- `api/config/development.mjs` and `worker/config/development.mjs` add a `registry` block with the dev URL/secret and `cacheDir: '../data/registry-cache'`.

#### E.2 Test fixtures
- New helper `tests/support/registry.ts` with `publishFixturePlugin(tgzPath, { architecture, public, privateAccess })` that POSTs to registry with `x-secret-key`.
- In `tests/state-setup.ts`, after the existing `DELETE /api/v1/test-env` cleanup, add a registry cleanup endpoint call (or directly clear the registry's mongo `data-fair-registry` db).
- `tests/fixtures/processing-hello-world.tgz` — kept and reused as the canonical fixture, published to registry by `publishFixturePlugin` in tests that need it.

#### E.3 Tests that change
- Delete `tests/features/plugins/install.api.spec.ts` and `tests/features/plugins/registry.api.spec.ts`.
- `tests/features/processings/lifecycle.api.spec.ts` — every `processing.plugin` literal becomes `{ name, version }`. Setup pre-publishes the fixture plugin and grants access to the test org via `POST /api/v1/access-grants`.
- `tests/features/processings/permissions.api.spec.ts` — same plugin-shape rewrite + ensure registry grants exist for the orgs each test exercises (or that the artefact is `public:true`).
- New `tests/features/registry-integration/migration.api.spec.ts` — pre-seeds a `dataDir/plugins/...` fixture, runs the upgrade scripts, asserts the artefact + grants now exist in registry and the corresponding `processings` rows are rewritten.

### F. Deprecation timeline
- **v6.0** (this work): legacy plugins volume optional, read-only for plugin-config injection. First-boot migration runs idempotently. UI plugin admin gone. Registry is source of truth for everything else.
- **v6.x patches**: monitor "deprecation: plugin used pluginConfig" warnings in worker logs; encourage plugin authors to publish updated versions that don't read it.
- **v7.0**: drop `config.dataDir`, the `if (config.dataDir)` block in worker `task.ts`, the `legacyIdFor()` helper, the `upgrade/6.0.0/` scripts, and the volume mount in deploy manifests / docker-compose.

## Critical files to change

Registry (`/home/alban/data-fair/registry`):
- `api/src/artefacts/service-pure.ts`
- `api/src/artefacts/router.ts`
- `api/src/auth.ts`
- `api/src/access.ts`
- `api/types/artefact/schema.js`
- `lib-node/index.ts`, `lib-node/index.d.ts`

Processings (`/home/alban/data-fair/processings_feat-registry`):
- `worker/src/task/task.ts`
- `api/src/processings/router.ts`
- `api/src/app.ts`
- `api/types/processing/schema.js`
- `api/config/default.mjs`, `worker/config/default.mjs`, `*/config/custom-environment-variables.mjs`
- `api/src/config.ts` (uiConfig)
- `ui/src/pages/processings/new.vue` (or wherever the plugin picker is)
- `docker-compose.yml`, `dev/init-env.sh`, `dev/resources/nginx.conf.template`
- New: `upgrade/6.0.0/01-publish-plugins-to-registry.ts`, `02-push-metadata-and-access.ts`, `03-rewrite-processing-plugin.ts`
- New: `tests/support/registry.ts`, `tests/features/registry-integration/migration.api.spec.ts`

To delete:
- `api/src/plugins/router.ts`, `api/src/plugins-registry/router.ts`, `api/types/plugin/`
- `ui/src/pages/admin/plugins.vue`
- `tests/features/plugins/install.api.spec.ts`, `tests/features/plugins/registry.api.spec.ts`

## Verification

### End-to-end manual test
1. `docker compose --profile dev up -d` — brings up registry alongside processings, mongo, simple-directory.
2. As superadmin in registry UI, create an upload API key.
3. Build a self-contained plugin tarball (`npm pack` over a directory that already has `node_modules`) and `curl -F file=@plugin.tgz -F architecture=x64 -H 'x-api-key: ...' http://localhost/registry/api/v1/artefacts/@data-fair%2Fprocessing-hello-world/versions`.
4. PATCH the artefact `public: true` (or grant access to `organization:test_org1`).
5. As `test_admin1@test.com` in processings UI, navigate to `/processings/new` — registry plugin list renders.
6. Pick the plugin, fill config, save → API runs `validateFullProcessing` (HTTP fetch) and `prepareProcessing` (lib-node download to API cache). Both succeed.
7. Trigger a run. Worker downloads via lib-node into its own cache (`downloaded: true` first time, `false` on the next run).
8. Smoke checks:
   - Revoke org's grant in registry → next run fails with a clear 403 from `ensureArtefact`.
   - Upload only `arm64` of a new version on an `x64` worker → 404. Re-upload without `architecture` → noarch fallback works on both arches.

### Tests that must pass
- `tests/features/processings/lifecycle.api.spec.ts` (rewritten)
- `tests/features/processings/permissions.api.spec.ts` (rewritten)
- New `tests/features/registry-integration/migration.api.spec.ts`
- Registry: new arch-routing tests, x-account auth tests
- Existing unit tests in `tests/features/worker-utils/`, `api-utils/`, `shared/` (not affected)

### Smoke matrix
| Scenario | Expected |
|---|---|
| Owner has grant, plugin public, arch matches | 200, run completes |
| Owner has grant, plugin private with grant, arch matches | 200, run completes |
| Owner has grant, plugin private without grant on this org | 403 from `ensureArtefact`, run fails with clear log |
| x64 worker, only arm64 tarball exists | 404 |
| x64 worker, arm64 + noarch tarballs exist | 200, downloads noarch |
| Save with valid config | 200 |
| Save with config violating `processingConfigSchema` | 400 |
| First-boot migration on volume with 3 plugins | all 3 published once, idempotent on re-run |
| First-boot with one plugin already in registry | skipped, no error |
| Migration with orphan `processing.plugin` (dir missing) | startup fails fast with operator-actionable error |
| Migration with distTag plugin dir | warning logged, processing referencing it left as legacy string until manually fixed |
