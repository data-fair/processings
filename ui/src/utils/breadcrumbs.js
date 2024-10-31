/**
 * @param {{text: string, to?: string}[]} breadcrumbs
 */
export const setBreadcrumbs = (breadcrumbs) => {
  if (window.parent) parent.postMessage({ breadcrumbs }, '*')
  else console.log('Breadcrumbs:', breadcrumbs)
}
export default setBreadcrumbs
