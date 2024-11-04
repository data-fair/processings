import type { Plugin } from '#api/types'

const fetches: Record<string, ReturnType<typeof useFetch<Plugin>>> = {}

export const usePluginFetch = async (pluginId: string) => {
  if (!fetches[pluginId]) {
    const pluginFetch = useFetch<Plugin>(`/api/v1/plugins/${pluginId}`)
    fetches[pluginId] = pluginFetch
  }
  return fetches[pluginId]
}
export default usePluginFetch
