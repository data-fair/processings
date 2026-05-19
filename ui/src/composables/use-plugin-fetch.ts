import { parsePluginId } from '@data-fair/processings-shared/plugin-id.ts'

// Subset of registry's Artefact shape that the UI uses. Two flavours share
// the same shape:
//  - `npm` artefacts are keyed by package name; per-major data
//    (processingConfigSchema, etc.) lives on the version documents.
//  - `branch` artefacts have no version history — a single mutable tarball
//    sits directly on the artefact doc, replaced on each upload. `branchName`
//    is optional metadata (the source git branch).
export interface RegistryArtefact {
  _id: string
  name: string
  format?: 'npm' | 'file' | 'branch'
  latestMajor?: number
  branchName?: string
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
