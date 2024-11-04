const fetches: Record<string, ReturnType<typeof useFetch>> = {}

export const usePluginFetch = async (pluginId: string) => {
  if (!fetches[pluginId]) {
    const pluginFetch = useFetch(`/api/v1/plugins/${pluginId}`)
    fetches[pluginId] = pluginFetch
  }
  return fetches[pluginId]
}
export default usePluginFetch
