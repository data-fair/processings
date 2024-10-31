export const setBreadcrumbs = (breadcrumbs: { name: string; path: string }[]) => {
  if (window.parent) parent.postMessage({ breadcrumbs }, '*')
  else console.log('Breadcrumbs:', breadcrumbs)
}
export default setBreadcrumbs
