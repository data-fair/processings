export default ({ store, app, env, route, $vuetify }) => {
  let publicUrl = window.location.origin + env.basePath
  if (publicUrl.endsWith('/')) publicUrl = publicUrl.substr(0, publicUrl.length - 1)
  const dataFairUrl = new URL(env.dataFairUrl)
  dataFairUrl.host = new URL(publicUrl).host
  store.commit('setAny', {
    env: {
      ...env,
      // reconstruct this env var that we used to have but lost when implementing multi-domain exposition
      publicUrl,
      dataFairUrl: dataFairUrl.href,
    },
  })
  store.dispatch('session/init', {
    cookies: app.$cookies,
    directoryUrl: env.directoryUrl,
  })
  if (!store.getters.embed) {
    store.dispatch('session/loop', app.$cookies)
  }
  if (app.$cookies.get('theme_dark') !== undefined) $vuetify.theme.dark = app.$cookies.get('theme_dark')
  if (route.query.dark) $vuetify.theme.dark = route.query.dark === 'true'
}
