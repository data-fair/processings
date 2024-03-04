import ReconnectingWebSocket from 'reconnecting-websocket'
import useEventBus from '~/composables/event-bus'
import { defineNuxtPlugin } from 'nuxt/app'

function configureWS(wsUrl, suffix = '', eventBus) {
  console.log('Configure WS', wsUrl)
  if (window.WebSocket) {
    const ws = new ReconnectingWebSocket(wsUrl)
    const subscriptions = {}
    let ready = false

    ws.addEventListener('open', () => {
      ready = true
      Object.keys(subscriptions).forEach(channel => {
        if (subscriptions[channel]) ws.send(JSON.stringify({ type: 'subscribe', channel }))
        else ws.send(JSON.stringify({ type: 'unsubscribe', channel }))
      })
    })

    ws.addEventListener('close', () => {
      ready = false
    })

    eventBus.on('subscribe' + suffix, channel => {
      if (subscriptions[channel]) return
      subscriptions[channel] = true
      if (ready) ws.send(JSON.stringify({ type: 'subscribe', channel }))
    })

    eventBus.on('unsubscribe' + suffix, channel => {
      subscriptions[channel] = false
      if (ready) ws.send(JSON.stringify({ type: 'unsubscribe', channel }))
    })

    ws.onmessage = event => {
      const body = JSON.parse(event.data)
      if (body.type === 'message') {
        eventBus.emit(body.channel, body.data)
      }
      if (body.type === 'error' && body.data === 'authentication is required') {
        ws.close()
      }
    }
  }
}

export default defineNuxtPlugin(nuxtApp => {
  const eventBus = useEventBus()
  const runtimeConfig = useRuntimeConfig()
  const wsPublicUrl = (window.location.origin + runtimeConfig.public.basePath)
    .replace('http:', 'ws:').replace('https:', 'wss:')
  configureWS(`${wsPublicUrl}api/`, '', eventBus)

  // Only configure notify websocket in main back-office mode, not multi-domain embeds
  if (runtimeConfig.public.notifyWSUrl && new URL(runtimeConfig.public.notifyWSUrl).hostname === window.location.hostname) {
    configureWS(runtimeConfig.public.notifyWSUrl, '-notify', eventBus)
  }
})
