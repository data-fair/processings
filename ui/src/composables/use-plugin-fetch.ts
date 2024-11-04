import type { Plugin } from '#api/types'

const fetches: Record<string, ReturnType<typeof useFetch<Plugin>>> = {}

export const usePluginFetch = (pluginId: string) => {
  if (!fetches[pluginId]) {
    const pluginFetch = useFetch<Plugin>(`${$apiPath}/plugins/${pluginId}`)
    fetches[pluginId] = pluginFetch
  }
  return fetches[pluginId]
}
export default usePluginFetch
