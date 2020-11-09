export default ({ store, app, env, route, $vuetify }) => {
  store.dispatch('session/init', { cookies: app.$cookies, baseUrl: env.publicUrl + '/api/v1/session' })
  store.dispatch('session/loop', app.$cookies)
  if (app.$cookies.get('theme_dark') !== undefined) $vuetify.theme.dark = app.$cookies.get('theme_dark')
  if (route.query.dark) $vuetify.theme.dark = route.query.dark === 'true'
}
