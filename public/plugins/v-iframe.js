import '@koumoul/v-iframe/content-window.js'

export default ({ app }) => {
  window.vIframeOptions = { router: app.router }
}
