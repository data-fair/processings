// Pure helper extracted from task.ts.

/**
 * Apply a plugin's `patchConfig` patch to a processing config, in place.
 *
 * Same null semantics as the API's PATCH on a processing (`api/src/processings/router.ts`):
 * a null value removes the key instead of storing it. A plugin has no other way to reset a
 * config key — the whole config object is rewritten by the worker, never $set key by key —
 * and a stored null would leave the config invalid against the plugin's config schema
 * (`type: "string"` and friends do not accept null), which the API then rejects with a 400 on
 * the next save from the UI.
 *
 * An undefined value removes the key too. Several plugins already use that idiom (`datasets:
 * undefined`) and it already worked in the database, because the mongo client is built with
 * `ignoreUndefined: true` and drops such keys on serialization; removing it here only keeps the
 * in-memory config — the one the rest of the run reads — in sync with what gets stored.
 *
 * Only the top level is walked, like the API does: a patch is a shallow merge, nested objects
 * are replaced as a whole.
 */
export const applyConfigPatch = (config: Record<string, any>, patch: Record<string, any>): Record<string, any> => {
  for (const key of Object.keys(patch)) {
    if (patch[key] === null || patch[key] === undefined) delete config[key]
    else config[key] = patch[key]
  }
  return config
}
