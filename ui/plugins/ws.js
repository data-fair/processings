import ReconnectingWebSocket from 'reconnecting-websocket'
import useEventBus from '~/composables/event-bus'
import { defineNuxtPlugin } from '#app'

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
  const wsPublicUrl = (window.location.origin + '/api/').replace('http:', 'ws:').replace('https:', 'wss:')
  configureWS(wsPublicUrl, '', eventBus)
})
