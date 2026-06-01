import { $apiPath } from '../context'

// Subset of registry's Artefact shape that the UI uses. The artefact `_id` is
// exactly what we store on `processing.plugin`.
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
 * Fetch a processing's plugin metadata through the processings API
 * (`GET /processings/:id/plugin`). The API checks the caller's permission on
 * the processing, then fetches the artefact from the registry as the owner —
 * so a user with only an individual permission still sees the plugin even
 * without a personal registry grant.
 *
 * Errors (404 deleted, 403 no access) are NOT broadcast as a global ui
 * notification — callers read `error.value` and render their own inline state.
 * See processing-card.vue and pages/processings/[id]/index.vue.
 */
export const usePluginFetch = (processingId: string) => {
  if (!fetches[processingId]) {
    fetches[processingId] = useFetch<RegistryArtefact>(
      `${$apiPath}/processings/${encodeURIComponent(processingId)}/plugin`,
      { notifError: false }
    )
  }
  return fetches[processingId]
}

export default usePluginFetch
