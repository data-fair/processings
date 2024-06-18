/** @type {Record<string, ReturnType<typeof useFetch<any>>>} */
const fetches = {}

/**
 * @param {string} pluginId
 */
export const usePluginFetch = async (pluginId) => {
  if (!fetches[pluginId]) {
    // eslint-disable-next-line no-undef
    const pluginFetch = useFetch(`/api/v1/plugins/${pluginId}`, { lazy: true })
    fetches[pluginId] = pluginFetch
  }
  return fetches[pluginId]
}
export default usePluginFetch
