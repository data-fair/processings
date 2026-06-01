# Plugin info through the processing's permission boundary

**Date:** 2026-06-01
**Branch:** `fix-permission-transitivity`
**Status:** Approved design

## Problem

A user can be granted an *individual* permission (`read` / `exec` / `admin` via
the processing's `permissions` array) on a processing they do not own. Such a
user can open the processing, but the UI fetches the associated plugin's
metadata by calling the registry **directly from the browser**, authenticated
as that user:

```
GET /registry/api/v1/artefacts/:pluginId      (ui/src/pages/processings/[id]/index.vue:157)
GET /registry/api/v1/artefacts/:pluginId      (ui/src/composables/use-plugin-fetch.ts, used by processing-card.vue)
```

When the plugin is private and the **user** has no personal grant on it, the
registry returns 403/404. The UI interprets that as `pluginBroken`, shows the
"plugin broken" banner and suppresses the config form — even though the user is
legitimately allowed to see the processing.

The registry access *should* be evaluated against the processing's **owner**
(who, by construction, has a working grant — the processing runs as them), not
against the individual viewer. The existing `GET /:id/plugin-config-schema`
endpoint already does exactly this: it gates on the processing permission of the
**user**, then calls the registry on behalf of the **owner**
(`ensurePluginAndReadSchema` → `ensureArtefact({ account: processing.owner })`).
Only the metadata fetch was left going direct.

## Fix

Route plugin **metadata** through the processing API under the same
"processing-permission-on-the-user, then registry-grant-on-the-owner" rule, and
repoint both UI surfaces at it.

### API — new endpoint

`GET /api/v1/processings/:id/plugin` in `api/src/processings/router.ts`:

1. `session.reqAuthenticated(req)`, load the processing (404 if missing).
2. Gate identically to `/plugin-config-schema`:
   `getUserResourceProfile(owner, permissions, sessionState)` ∈ `{admin, exec, read}`
   → else 403. **Permission evaluated against the user.**
3. Fetch artefact metadata from `config.privateRegistryUrl`:
   `GET /api/v1/artefacts/:pluginId` with headers
   `x-secret-key: config.secretKeys.registry` and
   `x-account: JSON.stringify(owner)`. **Registry grant evaluated against the
   owner.** A lightweight authenticated GET — *not* `ensureArtefact`, which
   downloads and extracts the whole tarball (too heavy for metadata).
4. Return the artefact JSON. Translate registry errors at the boundary the same
   way `ensurePluginAndReadSchema` does: 403 → 403, 404 → 404 (so the UI's
   `pluginBroken` still fires for genuinely revoked/deleted plugins), anything
   else → 502.

Refactor: extract the shared registry-header construction
(`{ 'x-secret-key', 'x-account': JSON.stringify(account) }`) and the
status-translation so the new endpoint and `ensurePluginAndReadSchema` don't
drift apart.

### UI — repoint both surfaces

- `ui/src/pages/processings/[id]/index.vue` (~L155): change the `useFetch` URL
  from `/registry/api/v1/artefacts/:id` to
  `${$apiPath}/processings/${processingId}/plugin`.
- `ui/src/composables/use-plugin-fetch.ts`: change `usePluginFetch` to take the
  **processing id** (cache keyed by it) and fetch
  `${apiPath}/processings/:id/plugin`. The returned `RegistryArtefact` shape is
  unchanged, so consumers need no further change.
- `ui/src/components/processing/processing-card.vue` (~L194): pass the
  processing id to the widened `usePluginFetch`.

The plugin-**picker** flows (`ui/src/pages/processings/new.vue`,
`ui/src/components/processings-actions.vue`) keep their direct
`/registry/api/v1/artefacts` list calls — those are owner/admin creation
contexts where the user already has registry access. Out of scope.

## Tests

API test under `tests/features/processings/` (alongside
`plugin-access.api.spec.ts`):

- **Regression target:** a user with an individual `read` permission on a
  processing whose **owner** has plugin access — but who has **no** personal
  grant — gets `200` from `GET /:id/plugin`.
- No permission on the processing → 403.
- Owner itself lacks the plugin grant → 403.
- Unknown / deleted plugin → 404.

## Docs

- Update `docs/architecture/v6-registry-integration.md`: the section describing
  the UI fetching plugin metadata same-origin from `/registry` is now partly
  superseded — plugin **metadata** flows through the processing API under the
  processing-permission-then-owner-grant rule. Note this explicitly.

## Out of scope / known follow-up

- **Thumbnails.** Plugin thumbnails are only rendered in the picker
  (`new.vue:75`, owner/admin context). The list cards and detail page carry the
  `thumbnail` field in the type but do not display it, so there is nothing to
  forward today. If a thumbnail is ever shown on a permitted-but-ungranted
  user's card/detail, it would 403 the same way and need an equivalent
  processing-scoped proxy. Noted, not built.
