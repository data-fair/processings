/**
 * `pluginId` is the registry artefact id stored on `processing.pluginId`.
 * Shape: `{name}@{major}` where `name` is the npm package name (which itself
 * may start with `@scope/`). Split on the LAST `@` so scoped names parse.
 */
export interface ParsedPluginId {
  name: string
  major: string
}

export const parsePluginId = (pluginId: string): ParsedPluginId => {
  const at = pluginId.lastIndexOf('@')
  if (at <= 0) throw new Error(`invalid pluginId "${pluginId}": expected "{name}@{major}"`)
  return { name: pluginId.slice(0, at), major: pluginId.slice(at + 1) }
}
