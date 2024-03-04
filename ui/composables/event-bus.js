import { reactive } from 'vue'

const events = reactive(new Map())

export default function useEventBus() {
  function emit(event, ...args) {
    const handlers = events.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(...args))
    }
  }

  function on(event, handler) {
    const handlers = events.get(event) || []
    events.set(event, [...handlers, handler])
  }

  function off(event, handler) {
    const handlers = events.get(event)
    if (handlers) {
      events.set(event, handlers.filter(h => h !== handler))
    }
  }

  return { emit, on, off }
}
