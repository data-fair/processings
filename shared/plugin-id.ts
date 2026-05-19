/**
 * `pluginId` is the registry artefact id stored on `processing.pluginId`.
 *
 * Two shapes:
 * - Versioned (npm-format artefact): `{name}@{major}` — e.g.
 *   `@data-fair/processing-hello-world@1`. The registry resolves to the
 *   latest minor.patch within that major at run time.
 * - Rolling (branch-format artefact): `{name}` — no `@major` suffix. The
 *   tarball at that artefact id is mutable; the registry serves whatever
 *   was last uploaded.
 *
 * Scoped names start with a leading `@` (e.g. `@scope/pkg`). To support
 * scoped names without a major suffix we split on the LAST `@` and treat
 * `at <= 0` as "no major" — both the empty string and a leading-only `@`
 * fall in that bucket.
 */
export interface ParsedPluginId {
  name: string
  /** Absent for branch-format artefacts. */
  major?: string
}

export const parsePluginId = (pluginId: string): ParsedPluginId => {
  if (!pluginId) throw new Error('invalid pluginId: empty')
  const at = pluginId.lastIndexOf('@')
  if (at <= 0) return { name: pluginId }
  return { name: pluginId.slice(0, at), major: pluginId.slice(at + 1) }
}
