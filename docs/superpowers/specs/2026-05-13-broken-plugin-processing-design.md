# Broken-plugin processings — design

Date: 2026-05-13
Branch: `feat-registry`

## Problem

A processing references a plugin in the registry via its `pluginId` (`{name}@{major}`). After the registry was introduced, two new failure modes appeared:

- The plugin has been **deleted** from the registry (404).
- The plugin still exists but the processing's owner **no longer has access** (403).

Today the user discovers this by opening the processing's edit page, which fires a registry fetch without error handling — the global `createUiNotif` shows an opaque 404. The list page also fires the same per-row registry fetch through `usePluginFetch` / `useFetch`, which auto-notifies on error, so the user sees a cascade of notifications when several processings are affected.

## Goal

Replace the bare 404 notification with a deliberate **"plugin unavailable"** state, visible on both the list and the edit page, that lets the user understand the situation and clean up (delete) — without obstructing access to the processing's metadata and run history.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| What can the user do with a broken processing? | Read-only view + delete only. Title/schedule cannot be edited. |
| Show a badge on the list? | Yes — inline indicator per row. No separate filter/section. |
| Differentiate 404 (deleted) from 403 (forbidden) in copy? | No — single "plugin unavailable" state. |
| Worker behaviour when a run starts on a broken processing? | Fail the run with a clear log line. No auto-disable. |

## Touchpoints (already-correct paths skipped)

1. **`ui/src/composables/use-plugin-fetch.ts`** — suppress the global notification on fetch error; callers render their own inline state.
2. **`ui/src/pages/processings/[id]/index.vue` (edit page)** — detect the broken state, render a banner, hide form / save / trigger.
3. **`ui/src/components/processing/processing-card.vue` (list row)** — soften existing "Deleted" copy to a neutral "Plugin unavailable" so the same UI works for 403 too.
4. **`worker/src/task/task.ts`** — wrap `ensureArtefact` in try/catch; log a friendly French message on 404/403 before re-throwing.

Server-side enforcement is **already correct**:
- `PATCH /processings/:id` runs `validateFullProcessing` → `ensurePluginAndReadSchema`, which throws the registry's 404/403.
- `DELETE /processings/:id` does not touch the plugin.
- `GET /processings/:id` returns the document without touching the registry.

No API contract changes; no new fields on the processing document.

## Detailed design

### 1. `use-plugin-fetch.ts` — suppress global notification

Current:
```ts
fetches[name] = useFetch<RegistryArtefact>(
  `/registry/api/v1/artefacts/${encodeURIComponent(name)}`
)
```

Change: pass `notifError: false` to the `useFetch` options. From `@data-fair/lib-vue/fetch.js` (lines 39-41), this disables the auto-notification while keeping `error.value` populated so callers can react.

This single change ends the notification cascade on the list page; every caller already renders its own inline error state.

### 2. Edit page — banner + read-only

**Detection.** Replace the bare `$fetch` (currently `index.vue:131-137`) by reusing `usePluginFetch`. This shares the cache with the list page and benefits from the notification suppression above. The `error` ref drives the broken state:

```ts
const pluginFetch = usePluginFetch(processing.value.pluginId)
const pluginBroken = computed(() => !!pluginFetch.error.value?.statusCode)
```

The config-schema fetch keeps its existing `.catch(404 → null)` shape — that's a separate, narrower concern (missing schema file for an *available* plugin) and shouldn't trigger the broken banner.

**Banner.** A `v-alert` of type `error` at the top of the page (above the title block), rendered when `pluginBroken` is true:

> EN: *"This processing's plugin is no longer available (deleted or access revoked). You can no longer edit or run it, but you can still view its history and delete it."*
>
> FR: *"Le plugin de ce traitement n'est plus disponible (supprimé ou accès retiré). Vous ne pouvez plus le modifier ni l'exécuter, mais vous pouvez consulter son historique et le supprimer."*

The `pluginId` is shown as `<code>` inside the banner.

**Affordances when `pluginBroken`.**
- Config form: already hidden (existing `v-if="processingSchema"` guards it; `configSchema` will be absent because the schema fetch fails too).
- Title, scheduling, permissions controls: hidden.
- Save button: hidden.
- "Run now" / trigger actions: hidden.
- Delete button (`processings-actions.vue`): visible — it doesn't depend on schema/plugin data.
- Runs history section: rendered as today.

### 3. List row — copy adjustment

`processing-card.vue` already shows the inline error state at lines 40-50 (`mdiPowerPlug` red icon + "Deleted - {pluginId}"). Two adjustments:

- Rename the i18n key `deleted` → `pluginUnavailable`. EN: "Plugin unavailable"; FR: "Plugin indisponible".
- Add a `:title` tooltip on the list item with the longer explanation (same copy as the edit-page banner) so hovering provides a hint without clicking through.

No structural change.

### 4. Worker — friendly log on plugin unavailability

`worker/src/task/task.ts:94` calls `ensureArtefact`. Wrap it in try/catch:

```ts
try {
  ensured = await ensureArtefact({ ... })
} catch (err) {
  const status = (err as any)?.statusCode
  if (status === 404 || status === 403) {
    await log.error(`Le plugin ${processing.pluginId} n'est plus disponible (supprimé ou accès retiré).`)
  }
  throw err
}
```

The error continues to propagate so the surrounding run-lifecycle code marks the run as `error` exactly as today. No state mutation on the processing.

## Testing

### Test setup — making a processing's plugin unavailable

Tests must not write directly to mongo. The normal API can't help either — `PATCH /processings/:id` validates the plugin and would reject a swap to a non-existent `pluginId`.

We add a dedicated route to the test-env router (`api/src/misc/routers/test-env.ts`):

```
PATCH /api/v1/test-env/raw-processing/:id
```

Body: a partial processing document. The handler does `mongo.processings.updateOne({ _id }, { $set: body })` without going through validation, mirroring the existing `GET /raw-processing/:id` shape. Like the rest of the test-env router this is only mounted when `NODE_ENV=development`. Tests use it to flip `pluginId` to a synthetic value (e.g. `@test/never-existed@1`) after creating the processing through the normal flow.

### API (`tests/features/...api.spec.ts`)

Pin the existing behaviour we rely on, and document the read-only contract:

- `GET /processings/:id` returns 200 with the processing whose `pluginId` doesn't resolve in the registry.
- `PATCH /processings/:id` returns the registry's 404/403 (no change — just lock it in).
- `DELETE /processings/:id` returns 204.

### UI e2e (`tests/features/processings/<file>.e2e.spec.ts`)

- Set up a processing referencing an unreachable plugin (see setup section above).
- Open the processings list → assert the "Plugin unavailable" badge and red plug icon on the relevant row, and that no global notification toast is rendered.
- Open the processing's edit page → assert the banner, absence of form/save/trigger, presence of delete.
- Click delete → assert the processing is removed.

### Worker

Covered by an e2e that triggers a run on a broken processing and asserts the run's log contains the friendly French line.

## Implementation order

1. `use-plugin-fetch.ts` — add `notifError: false`. Single line.
2. `processing-card.vue` — rename i18n key, add tooltip.
3. Edit page — refactor fetch, banner, hide affordances.
4. Worker — try/catch + log line.
5. Test-env router — add `PATCH /raw-processing/:id`.
6. Tests (API, e2e) — depend on step 5.

Steps 1-2, 4 and 5 are independent. Step 3 depends on step 1. Step 6 depends on step 5.

## Out of scope

- Auto-disabling the processing after a failed run.
- Reattaching to a different plugin.
- Differentiating 404 vs 403 in copy.
- Caching plugin display name on the processing document.
- Filter/section in the list for broken processings.
- Major-version mismatch as a distinct broken state.
- Changes to the new-processing picker (already filters server-side).
- API-side enrichment of the list with `pluginAvailable` (the per-row UI fetch already exists).
