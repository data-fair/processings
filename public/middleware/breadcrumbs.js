export default async function ({ store, route, redirect }) {
  // initial navigation from the iframe parent
  if (route.query.to && route.query.to !== route.path) return redirect(route.query.to)

  // mirror all internal navigation in the iframe parent
  if (global.parent) parent.postMessage({ to: route.path }, '*')
}
