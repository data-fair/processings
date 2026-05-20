// Subset of registry's Artefact shape that the UI uses. The artefact `_id` is
// exactly what we store on `processing.plugin`, so we fetch the artefact by that.
export interface RegistryArtefact {
  _id: string
  name: string
  format?: 'npm' | 'file'
  version?: string
  category: string
  title?: { fr?: string, en?: string }
  description?: { fr?: string, en?: string }
  group?: { fr?: string, en?: string }
  documentation?: string
  thumbnail?: { id: string, width: number, height: number }
}

const fetches: Record<string, ReturnType<typeof useFetch<RegistryArtefact>>> = {}

/**
 * Fetch artefact metadata from the registry for a processing's `plugin`
 * (the registry artefact id).
 *
 * Errors (404 deleted, 403 no access) are NOT broadcast as a global ui
 * notification — callers read `error.value` and render their own inline
 * state. See processing-card.vue and pages/processings/[id]/index.vue.
 *
 * Same-domain assumption: registry is always mounted at `/registry` of the
 * current domain. The session cookie is sent automatically.
 */
export const usePluginFetch = (pluginId: string) => {
  if (!fetches[pluginId]) {
    fetches[pluginId] = useFetch<RegistryArtefact>(
      `/registry/api/v1/artefacts/${encodeURIComponent(pluginId)}`,
      { notifError: false }
    )
  }
  return fetches[pluginId]
}

export default usePluginFetch
