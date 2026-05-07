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
 * Same-domain assumption: registry is always mounted at `/registry` of the
 * current domain. The session cookie is sent automatically.
 */
export const usePluginFetch = (pluginId: string) => {
  const { name } = parsePluginId(pluginId)
  if (!fetches[name]) {
    fetches[name] = useFetch<RegistryArtefact>(`/registry/api/v1/artefacts/${encodeURIComponent(name)}`)
  }
  return fetches[name]
}

export default usePluginFetch
