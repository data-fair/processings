# Broken-Plugin Processings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the opaque global 404 notification with a deliberate "plugin unavailable" state on both the processings list and the processing edit page, and make the worker log a clear French message when a run hits a missing/forbidden plugin.

**Architecture:** Treat the registry's 404 (deleted) and 403 (no access) as a single "plugin unavailable" state. The UI detects it from the registry artefact fetch error; the worker detects it from `ensureArtefact` throwing. Read-only + delete-only on the edit page; "Plugin unavailable" badge in the list. No new fields on the processing document; the existing server-side enforcement (`PATCH` already validates the plugin; `DELETE` doesn't) is sufficient.

**Tech Stack:** TypeScript / Vue 3 / Vuetify / Express / Playwright. Spec at `docs/superpowers/specs/2026-05-13-broken-plugin-processing-design.md`.

---

## File Structure

**Modified (UI):**
- `ui/src/composables/use-plugin-fetch.ts` — suppress global notif on error.
- `ui/src/components/processing/processing-card.vue` — i18n key + tooltip for the existing inline error state.
- `ui/src/pages/processings/[id]/index.vue` — detect broken state, banner, hide form/save/exec.
- `ui/src/components/processing/processing-actions.vue` — accept a `plugin-broken` prop; hide exec/duplicate/change-owner; keep delete.

**Modified (API):**
- `api/src/misc/routers/test-env.ts` — add `PATCH /raw-processing/:id` for tests only.

**Modified (worker):**
- `worker/src/task/task.ts` — try/catch around `ensureArtefact`, friendly log on 404/403.

**New (tests):**
- `tests/features/processings/broken-plugin.api.spec.ts` — pin GET/PATCH/DELETE contract.
- `tests/features/processings/broken-plugin.e2e.spec.ts` — list badge + edit banner + delete.

---

## Task 1: Suppress global notification on plugin-fetch errors

**Files:**
- Modify: `ui/src/composables/use-plugin-fetch.ts`

### Why

`@data-fair/lib-vue/fetch.js` line 39-41 fires a global `sendUiNotif` whenever `useFetch` errors unless `notifError: false` is passed. The list page (`processing-card.vue`) already renders its own inline error state per row, so the global notification is duplicate noise. Pass the option to opt out.

- [ ] **Step 1: Add the `notifError: false` option to the useFetch call**

Replace the body of `usePluginFetch`:

```ts
import { parsePluginId } from '@data-fair/processings-shared/plugin-id.ts'

// Subset of registry's Artefact shape that the UI uses. Artefacts are now
// keyed by package name (no @major suffix); per-major data — including
// processingConfigSchema — lives on the version documents instead.
export interface RegistryArtefact {
  _id: string
  name: string
  latestMajor?: number
  category: string
  title?: { fr?: string, en?: string }
  description?: { fr?: string, en?: string }
  group?: { fr?: string, en?: string }
  documentation?: string
  thumbnail?: { id: string, width: number, height: number }
}

const fetches: Record<string, ReturnType<typeof useFetch<RegistryArtefact>>> = {}

/**
 * Fetch artefact metadata from the registry for a processing's pluginId
 * (`{name}@{major}`). Only the `name` part identifies the artefact; the
 * major is the runtime version pin and is not used here.
 *
 * Errors (404 deleted, 403 no access) are NOT broadcast as a global ui
 * notification — callers read `error.value` and render their own inline
 * state. See processing-card.vue and pages/processings/[id]/index.vue.
 *
 * Same-domain assumption: registry is always mounted at `/registry` of the
 * current domain. The session cookie is sent automatically.
 */
export const usePluginFetch = (pluginId: string) => {
  const { name } = parsePluginId(pluginId)
  if (!fetches[name]) {
    fetches[name] = useFetch<RegistryArtefact>(
      `/registry/api/v1/artefacts/${encodeURIComponent(name)}`,
      { notifError: false }
    )
  }
  return fetches[name]
}

export default usePluginFetch
```

- [ ] **Step 2: Type-check**

Run: `npm run check-types`
Expected: passes (no new type errors).

- [ ] **Step 3: Commit**

```bash
git add ui/src/composables/use-plugin-fetch.ts
git commit -m "fix(ui): suppress global notif on plugin-fetch error

Callers (processing-card, processing edit page) render their own inline
error state; the global notification was duplicate noise."
```

---

## Task 2: List row — "Plugin unavailable" copy + tooltip

**Files:**
- Modify: `ui/src/components/processing/processing-card.vue`

### Why

Lines 40-50 already render an inline error state when `pluginFetch.error.value?.statusCode` is truthy. The label is currently `"Deleted - {pluginId}"`, which doesn't fit the 403 case. Soften the wording and add a tooltip with the longer explanation.

- [ ] **Step 1: Rewrite the error v-list-item**

Replace lines 40-50 in `ui/src/components/processing/processing-card.vue`:

```vue
        <v-list-item
          v-else-if="pluginFetch.error.value?.statusCode"
          :title="t('pluginUnavailableHint')"
        >
          <template #prepend>
            <v-icon
              :icon="mdiPowerPlug"
              color="error"
            />
          </template>
          <span class="text-error">
            {{ t('pluginUnavailable') + ' — ' + processing.pluginId }}
          </span>
        </v-list-item>
```

- [ ] **Step 2: Update the i18n block — remove `deleted`, add `pluginUnavailable` + `pluginUnavailableHint`**

Replace the `deleted:` lines in both `en:` and `fr:` blocks (around lines 195 and 209):

```yaml
  en:
    pluginUnavailable: Plugin unavailable
    pluginUnavailableHint: This processing's plugin has been removed or its access revoked. You can no longer edit or run it, but you can view its history and delete it.
    runStarted: Run started
```

```yaml
  fr:
    pluginUnavailable: Plugin indisponible
    pluginUnavailableHint: Le plugin de ce traitement a été supprimé ou son accès retiré. Vous ne pouvez plus le modifier ni l'exécuter, mais vous pouvez consulter son historique et le supprimer.
    runStarted: Exécution commencée
```

Drop the old `deleted: Deleted` and `deleted: Supprimé` entries.

- [ ] **Step 3: Lint + type-check**

Run: `npm run lint && npm run check-types`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/processing/processing-card.vue
git commit -m "feat(ui): rename 'Deleted' badge to 'Plugin unavailable' with tooltip

Covers both the 404 (plugin deleted) and 403 (no access) cases. Tooltip
echoes the edit-page banner so users get the full explanation on hover."
```

---

## Task 3: Test-env router — `PATCH /raw-processing/:id`

**Files:**
- Modify: `api/src/misc/routers/test-env.ts`

### Why

Tests must not write directly to mongo. The normal `PATCH /processings/:id` validates the plugin via `ensurePluginAndReadSchema`, so it can't be used to set a `pluginId` that doesn't resolve. We add a dev-only PATCH endpoint that updates the processing document raw, mirroring the existing `GET /raw-processing/:id` shape. The test-env router is only mounted when `NODE_ENV=development` (verify in `api/src/main.ts`'s router wiring).

- [ ] **Step 1: Add the route**

Insert immediately after the existing `GET /raw-processing/:id` block (around line 53):

```ts
// Patch a processing document without validation (used by tests to put a
// processing into states that the normal API guards prevent, e.g. setting
// pluginId to a value that doesn't resolve in the registry).
router.patch('/raw-processing/:id', async (req, res, next) => {
  try {
    const result = await mongo.processings.updateOne(
      { _id: req.params.id },
      { $set: req.body }
    )
    if (result.matchedCount === 0) return res.status(404).json({ error: 'processing not found' })
    const processing = await mongo.processings.findOne({ _id: req.params.id })
    res.json(processing)
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2: Verify the router is dev-only (read, do not modify)**

Run: `grep -n "test-env" api/src/main.ts api/src/router.ts 2>/dev/null`
Expected: there's a mount guarded by `NODE_ENV === 'development'`. If not, raise the concern — but the AGENTS.md confirms: *"When `NODE_ENV=development` the API exposes `/api/v1/test-env`"*.

- [ ] **Step 3: Lint + type-check**

Run: `npm run lint && npm run check-types`
Expected: passes.

- [ ] **Step 4: Manual smoke**

Start the dev API is already running (zellij). Run:

```bash
curl -s -X PATCH http://localhost:$DEV_API_PORT/api/v1/test-env/raw-processing/does-not-exist \
  -H 'content-type: application/json' -d '{"pluginId":"x"}' | head
```

Expected: `{"error":"processing not found"}` with HTTP 404. (Read `$DEV_API_PORT` from `.env`.)

- [ ] **Step 5: Commit**

```bash
git add api/src/misc/routers/test-env.ts
git commit -m "test: add PATCH /test-env/raw-processing/:id for invalid-state setups

Lets tests put processings into broken states the normal API guards
prevent — e.g. a pluginId that doesn't resolve in the registry."
```

---

## Task 4: Worker — friendly log on plugin unavailability

**Files:**
- Modify: `worker/src/task/task.ts:93-106`

### Why

`ensureArtefact` throws an HTTP-shaped error (404 deleted, 403 no access). Today it bubbles up unwrapped and the run's log gets whatever the registry returned. Add a try/catch that, on 404/403 only, prepends a clear French log line via `log.error`. Other errors (network, etc.) propagate unchanged. Run lifecycle is unaffected because we re-throw.

- [ ] **Step 1: Wrap `ensureArtefact` in try/catch**

Replace the existing block at lines 93-106:

```ts
  const { name: pluginName, major } = parsePluginId(processing.pluginId)
  let ensured
  try {
    ensured = await ensureArtefact({
      registryUrl: config.privateRegistryUrl,
      secretKey: config.secretKeys.registry,
      artefactId: pluginName,
      version: major,
      cacheDir: registryCacheDir,
      architecture: process.arch,
      account: {
        type: processing.owner.type,
        id: processing.owner.id,
        ...(processing.owner.department ? { department: processing.owner.department } : {})
      }
    })
  } catch (err) {
    const status = (err as any)?.statusCode
    if (status === 404 || status === 403) {
      await log.error(`Le plugin ${processing.pluginId} n'est plus disponible (supprimé ou accès retiré).`)
    }
    throw err
  }
  const pluginDir = ensured.path
```

(Note: `ensured` is declared `let` so it's visible after the try block.)

- [ ] **Step 2: Type-check**

Run: `npm run check-types`
Expected: passes.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add worker/src/task/task.ts
git commit -m "feat(worker): friendly log when a run's plugin is unavailable

Wrap ensureArtefact in try/catch; on 404 (deleted) or 403 (no access)
add a clear French log.error line before re-throwing. The run still
fails with status 'error' exactly as before."
```

---

## Task 5: Edit page — banner + read-only when plugin unavailable

**Files:**
- Modify: `ui/src/pages/processings/[id]/index.vue`

### Why

Today `fetchPlugin` calls `$fetch` on the registry artefact with no error handler, so a 404/403 throws into the async `onMounted` chain and the page renders without a form (and with whatever default Vue/Nuxt does about the unhandled rejection). Replace that with explicit error handling that sets a `pluginBroken` ref, and render a banner that explains the state. The config-schema fetch keeps its current `.catch(404 → null)` shape — that's a different state ("plugin available but schema missing") and must NOT trigger the broken banner.

- [ ] **Step 1: Add `pluginBroken` ref and refactor `fetchPlugin`**

Replace the current `fetchPlugin` (lines 125-140) and add a new ref next to the existing `plugin` ref (line 102):

```ts
const plugin: Ref<RegistryArtefact | null> = ref(null)
const pluginBroken = ref(false)
const configSchema: Ref<Record<string, unknown> | null> = ref(null)
```

```ts
async function fetchPlugin () {
  if (!processing.value?.pluginId) return
  const { name } = parsePluginId(processing.value.pluginId)
  // Display metadata comes from registry (artefact-level, name-keyed).
  // The config schema is read out of the cached package.json by the
  // processings API — registry doesn't know or care what's inside packages.
  //
  // Registry returns 404 when the plugin has been deleted, 403 when the
  // owner has lost access. We collapse both into pluginBroken=true and
  // render a banner; the config-schema fetch's 404 (no schema for this
  // major) is a separate, narrower state that does NOT trigger the banner.
  const artefactResult = await $fetch<RegistryArtefact>(
    `/registry/api/v1/artefacts/${encodeURIComponent(name)}`
  ).then(
    (data) => ({ ok: true as const, data }),
    (err) => {
      const status = err?.statusCode ?? err?.status
      if (status === 404 || status === 403) return { ok: false as const }
      throw err
    }
  )
  if (!artefactResult.ok) {
    pluginBroken.value = true
    return
  }
  plugin.value = artefactResult.data
  configSchema.value = await $fetch<Record<string, unknown>>(
    `/processings/${processingId}/plugin-config-schema`
  ).catch(err => {
    if (err?.statusCode === 404 || err?.status === 404) return null
    throw err
  })
}
```

Notes:
- The schema fetch is now sequential after the artefact fetch (it's gated on the artefact existing). The original parallel fetch saved one round-trip; in the broken case we skip the schema entirely, which is the right behavior.
- `processingSchema` (computed at line 159) already returns undefined when `!plugin.value` or `!configSchema.value`, so the form won't render in the broken case.

- [ ] **Step 2: Render the banner in the template**

Insert immediately after the opening `<v-container>` (between line 5 and line 6):

```vue
    <v-alert
      v-if="pluginBroken"
      type="error"
      variant="tonal"
      class="mb-4"
      :title="t('pluginUnavailableTitle')"
    >
      {{ t('pluginUnavailableBody') }}
      <br>
      <code>{{ processing?.pluginId }}</code>
    </v-alert>
    <h2 class="text-headline-small">
```

(Keep the existing `<h2>` line as-is — the alert sits above it.)

- [ ] **Step 3: Gate the form on `!pluginBroken`**

Change line 28 from:

```vue
        <vjsf
          v-if="processingSchema"
```

to:

```vue
        <vjsf
          v-if="processingSchema && !pluginBroken"
```

(Belt-and-braces: `processingSchema` is already undefined when broken because `plugin` is null, but the explicit guard keeps the template self-documenting.)

- [ ] **Step 4: Pass `pluginBroken` to processing-actions**

Change the `<processing-actions ... />` block (lines 56-65) to add the new prop:

```vue
      <processing-actions
        :processing="processing"
        :processing-schema="processingSchema"
        :can-admin="canAdminProcessing"
        :can-exec="canExecProcessing"
        :edited="edited"
        :is-small="false"
        :documentation="plugin?.documentation"
        :plugin-broken="pluginBroken"
        @triggered="runs && runs.refresh()"
      />
```

- [ ] **Step 5: Add the i18n keys**

In the `<i18n lang="yaml">` block, add to `en:` and `fr:` (alongside `processingTitle`, `updateError`, etc.):

```yaml
  en:
    pluginUnavailableTitle: Plugin unavailable
    pluginUnavailableBody: This processing's plugin has been removed or its access revoked. You can no longer edit or run this processing, but you can still view its run history and delete it.
```

```yaml
  fr:
    pluginUnavailableTitle: Plugin indisponible
    pluginUnavailableBody: Le plugin de ce traitement a été supprimé ou son accès retiré. Vous ne pouvez plus modifier ni exécuter ce traitement, mais vous pouvez consulter son historique et le supprimer.
```

- [ ] **Step 6: Lint + type-check**

Run: `npm run lint && npm run check-types`
Expected: passes. (Step 5 — `pluginBroken` is referenced before processing-actions accepts the prop, see Task 6.)

If type-check fails on the unknown prop, proceed to Task 6 and re-run. If lint fails on yaml indentation, match the indentation of the surrounding keys in the file.

- [ ] **Step 7: Commit**

```bash
git add ui/src/pages/processings/[id]/index.vue
git commit -m "feat(ui): broken-plugin banner + hide form on processing edit page

Catch 404/403 from the registry artefact fetch, set pluginBroken, show
a v-alert explaining the state. The config-schema fetch's own 404 is
unchanged (separate, narrower state that does not trigger the banner).
Plumbs pluginBroken to processing-actions so the trigger/duplicate/
change-owner actions can be hidden — see next task."
```

---

## Task 6: processing-actions — hide non-delete actions when plugin is broken

**Files:**
- Modify: `ui/src/components/processing/processing-actions.vue`

### Why

The processing-actions component renders Execute, Duplicate, Delete, and Change-Owner. When the plugin is unavailable, only Delete should remain — Execute would fail in the worker, Duplicate produces another broken processing, Change-Owner is too marginal to keep for this iteration.

- [ ] **Step 1: Add the `pluginBroken` prop**

Locate the `defineProps` block (somewhere near the top of the `<script setup>`; the file uses Vue 3's prop declaration). Add `pluginBroken: Boolean` alongside the existing props. If the file uses the object form, add `pluginBroken: { type: Boolean, default: false }`.

Run: `grep -n "defineProps\|pluginBroken" ui/src/components/processing/processing-actions.vue`
to confirm the change.

- [ ] **Step 2: Gate Execute on `!pluginBroken`**

Find the Execute affordance (`<v-list-item v-if="canAdmin || canExec"` at line 4) and tighten the guard:

```vue
  <v-list-item
    v-if="(canAdmin || canExec) && !pluginBroken"
```

- [ ] **Step 3: Gate Duplicate on `!pluginBroken`**

Find the Duplicate affordance (`v-if="canAdmin"` at line 68) and tighten:

```vue
  <v-list-item
    v-if="canAdmin && !pluginBroken"
```

(There are two `v-if="canAdmin"` blocks — line 68 is Duplicate and line 171 is Change-Owner. Use the surrounding `{{ t('duplicate') }}` to identify the Duplicate one. The Delete block at line 123 stays untouched.)

- [ ] **Step 4: Gate Change-Owner on `!pluginBroken`**

Find the Change-Owner affordance (around line 171, identifiable by `{{ t('changeOwner') }}`) and tighten:

```vue
  <v-list-item
    v-if="canAdmin && !pluginBroken"
```

- [ ] **Step 5: Lint + type-check**

Run: `npm run lint && npm run check-types`
Expected: passes.

- [ ] **Step 6: Manual smoke (optional but recommended)**

Open the dev UI in a browser, navigate to a processing edit page. Confirm normal state still shows all actions. (Broken-state smoke will be exercised by the e2e tests in Task 8.)

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/processing/processing-actions.vue
git commit -m "feat(ui): hide exec/duplicate/change-owner when plugin is broken

Delete remains so the user can clean up. Triggered by the new
plugin-broken prop wired from the edit page in the previous commit."
```

---

## Task 7: API tests — pin GET/PATCH/DELETE contract on broken processings

**Files:**
- Create: `tests/features/processings/broken-plugin.api.spec.ts`

### Why

The API behavior we rely on (GET works, PATCH fails with the registry's status, DELETE works) is correct already. Add tests that pin it so future changes can't silently break the read-only contract that the UI now depends on.

- [ ] **Step 1: Write the spec**

Create `tests/features/processings/broken-plugin.api.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { anonymousAx, apiUrl, axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

// Helper: create a processing through the normal API, then flip its
// pluginId to a value that doesn't resolve in the registry via the
// dev-only test-env raw-processing PATCH endpoint.
const createBrokenProcessing = async (
  superadmin: Awaited<ReturnType<typeof axiosAuth>>
) => {
  const fixture = await publishFixturePlugin({
    name: '@data-fair/processing-hello-world',
    version: '1.2.2'
  })
  const processing = (await superadmin.post('/api/v1/processings', {
    title: 'Broken processing',
    pluginId: fixture.pluginId,
    owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
  })).data
  await anonymousAx.patch(
    `${apiUrl}/api/v1/test-env/raw-processing/${processing._id}`,
    { pluginId: '@test/never-existed@1' }
  )
  return processing._id as string
}

test.describe('processing with unavailable plugin', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('GET /processings/:id returns 200', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const id = await createBrokenProcessing(superadmin)

    const res = await superadmin.get(`/api/v1/processings/${id}`)
    expect(res.status).toBe(200)
    expect(res.data._id).toBe(id)
    expect(res.data.pluginId).toBe('@test/never-existed@1')
  })

  test('PATCH /processings/:id surfaces the registry error', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const id = await createBrokenProcessing(superadmin)

    const res = await superadmin.patch(
      `/api/v1/processings/${id}`,
      { title: 'New title' },
      { validateStatus: () => true }
    )
    // Registry returns 404 for an unknown artefact; the API surfaces the
    // status as-is through ensurePluginAndReadSchema.
    expect([403, 404]).toContain(res.status)
  })

  test('DELETE /processings/:id returns 204', async () => {
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const id = await createBrokenProcessing(superadmin)

    const del = await superadmin.delete(`/api/v1/processings/${id}`)
    expect(del.status).toBe(204)

    // GET now 404s — the processing is gone.
    const after = await superadmin.get(
      `/api/v1/processings/${id}`,
      { validateStatus: () => true }
    )
    expect(after.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the new spec**

Run: `npx playwright test tests/features/processings/broken-plugin.api.spec.ts`
Expected: all three tests pass.

If `PATCH` returns a 400 instead of 403/404, inspect the response body — `ensurePluginAndReadSchema` might wrap the error. Adjust the `expect([403, 404]).toContain(res.status)` to whatever the API actually returns (the goal is to pin the *current* behavior, not assert a specific status).

- [ ] **Step 3: Commit**

```bash
git add tests/features/processings/broken-plugin.api.spec.ts
git commit -m "test(api): pin read-only contract for broken-plugin processings

GET still works, PATCH surfaces the registry's 404/403, DELETE works.
Uses the new test-env raw-processing PATCH to set up the broken state."
```

---

## Task 8: E2E tests — list badge + edit-page banner + delete

**Files:**
- Create: `tests/features/processings/broken-plugin.e2e.spec.ts`

### Why

End-to-end check that the user-visible UI matches the design: list row shows the unavailable badge, edit page shows the banner, the form is hidden, delete succeeds.

- [ ] **Step 1: Write the spec**

Create `tests/features/processings/broken-plugin.e2e.spec.ts`:

```ts
import { test, expect } from '../../fixtures/login.ts'
import { anonymousAx, apiUrl, axiosAuth, clean } from '../../support/axios.ts'
import { publishFixturePlugin } from '../../support/registry.ts'

const setupBrokenProcessing = async () => {
  const superadmin = await axiosAuth('test_superadmin@test.com')
  const fixture = await publishFixturePlugin({
    name: '@data-fair/processing-hello-world',
    version: '1.2.2'
  })
  const processing = (await superadmin.post('/api/v1/processings', {
    title: 'Broken e2e processing',
    pluginId: fixture.pluginId,
    owner: { type: 'user', id: 'test_superadmin', name: 'Test Super Admin' }
  })).data
  await anonymousAx.patch(
    `${apiUrl}/api/v1/test-env/raw-processing/${processing._id}`,
    { pluginId: '@test/never-existed@1' }
  )
  return processing._id as string
}

test.describe('processing with unavailable plugin — UI', () => {
  test.beforeEach(clean)
  test.afterAll(clean)

  test('list shows the "Plugin indisponible" badge', async ({ page, goToWithAuth }) => {
    await setupBrokenProcessing()
    await goToWithAuth('/processings/processings', 'test_superadmin')
    await expect(page.getByText('Broken e2e processing')).toBeVisible({ timeout: 10000 })
    // FR locale is the test default.
    await expect(page.getByText(/Plugin indisponible/)).toBeVisible()
  })

  test('edit page shows the banner and hides the form', async ({ page, goToWithAuth }) => {
    const id = await setupBrokenProcessing()
    await goToWithAuth(`/processings/processings/${id}`, 'test_superadmin')

    // Banner present.
    await expect(page.getByText(/Plugin indisponible/).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Le plugin de ce traitement a été supprimé/)).toBeVisible()

    // Form not rendered (vjsf doesn't render → no inputs from the plugin
    // config). We assert the absence of the "config" section title; if the
    // selector below is fragile in your local UI, tighten it after first run.
    await expect(page.locator('form').filter({ hasText: 'Plugin' })).toHaveCount(0)

    // Delete button still present.
    await expect(page.getByText(/Supprimer/).first()).toBeVisible()
  })

  test('delete from the edit page removes the processing', async ({ page, goToWithAuth }) => {
    const id = await setupBrokenProcessing()
    await goToWithAuth(`/processings/processings/${id}`, 'test_superadmin')

    await page.getByText(/Supprimer/).first().click()
    // Confirmation dialog: click the confirm button. The actions component
    // uses `t('yes')` for confirm — its label is "Oui" in FR.
    await page.getByRole('button', { name: /Oui/ }).click()

    // Verify the processing is gone via the API.
    const superadmin = await axiosAuth('test_superadmin@test.com')
    const res = await superadmin.get(
      `/api/v1/processings/${id}`,
      { validateStatus: () => true }
    )
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the new spec**

Run: `npx playwright test tests/features/processings/broken-plugin.e2e.spec.ts`
Expected: all three tests pass.

If selectors fail, open the dev UI in a browser, navigate to a broken processing, and inspect the actual labels. Update the regexes to match what's rendered. Don't loosen assertions to make them pass — fix the selectors precisely.

- [ ] **Step 3: Commit**

```bash
git add tests/features/processings/broken-plugin.e2e.spec.ts
git commit -m "test(e2e): list badge, edit banner, delete on broken-plugin processings"
```

---

## Self-Review

**Spec coverage:**
- ✅ Edit page banner + read-only + delete-only → Task 5 + Task 6
- ✅ List badge with neutral wording → Task 2
- ✅ Single "unavailable" state (no 403/404 differentiation) → Tasks 2, 5 (single banner copy)
- ✅ Worker fails with clear log → Task 4
- ✅ No global notification noise → Task 1
- ✅ Test-env support → Task 3
- ✅ API contract pinned → Task 7
- ✅ UI behaviour pinned → Task 8

**Out of scope (per spec) — confirmed NOT in plan:** auto-disable, reattach, 404/403 differentiation copy, cached plugin name, list filter, major-version mismatch, new-processing changes, API list enrichment.

**Type consistency check:** the `pluginBroken` prop is added to `processing-actions.vue` in Task 6, and consumed in Task 5. Task 5 step 6 notes that type-check might fail until Task 6 lands — re-run after Task 6.

**Placeholder scan:** no TBD/TODO/"similar to" references; every step has the actual code or command.
