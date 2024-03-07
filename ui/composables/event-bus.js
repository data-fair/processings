import { reactive } from 'vue'

const events = reactive(new Map())

export default function useEventBus() {
  /**
   * @param {any} event
   * @param {any[]} args
   */
  function emit(event, ...args) {
    const handlers = events.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(...args))
    }
  }

  /**
   * @param {any} event
   * @param {any} handler
   */
  function on(event, handler) {
    const handlers = events.get(event) || []
    events.set(event, [...handlers, handler])
  }

  /**
   * @param {any} event
   * @param {any} handler
   */
  function off(event, handler) {
    const handlers = events.get(event)
    if (handlers) {
      events.set(event, handlers.filter((/** @type {any} */ h) => h !== handler))
    }
  }

  return { emit, on, off }
}
