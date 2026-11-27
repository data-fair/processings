import { ref, computed } from 'vue'
import { $fetch } from '../context'
import { fetchAllPages, type RegistryPage } from '../utils/registry-plugins'
import type { RegistryArtefact } from './use-plugin-fetch'

const plugins = ref<RegistryArtefact[] | null>(null)
const error = ref<unknown>(null)
let loading: Promise<void> | null = null

const load = () => {
  loading = fetchAllPages(skip => $fetch<RegistryPage<RegistryArtefact>>('/registry/api/v1/artefacts', {
    baseURL: '',
    query: { category: 'processing', includeDeprecated: true, size: 100, skip }
  }))
    .then(results => { plugins.value = results })
    .catch(err => { error.value = err })
  return loading
}

/**
 * The processing plugins of the registry, read once per page load and shared by the list (cards, plugin filter)
 * and the creation page, deprecated ones included: their processings still run, they only can no longer be chosen
 * for a new one.
 *
 * The registry filters them by the session's active account: see `pluginFromList` for when a card can rely on it,
 * and use-plugin-fetch.ts for the processings shared from another account.
 */
export const useRegistryPlugins = () => {
  if (!loading) load()
  const byId = computed(() => {
    if (!plugins.value) return null
    return Object.fromEntries(plugins.value.map(p => [p._id, p])) as Record<string, RegistryArtefact>
  })
  return { plugins, byId, error }
}

export default useRegistryPlugins
