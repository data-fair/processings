import { useScroll, useEventListener } from '@vueuse/core'

/**
 * Stick-to-bottom autoscroll for a live run log: follows new entries while the
 * user is at the bottom, any upward scroll or wheel-up stops it, scrolling back
 * to the bottom resumes.
 *
 * Targets the current document — what actually scrolls both standalone and
 * inside data-fair's fixed-height d-frame iframe (never window.top). VueUse's
 * `arrivedState.bottom` carries a built-in 1px tolerance, and appending a log
 * fires no scroll event, so following only ever turns off on a real upward
 * scroll — no manual threshold needed.
 *
 * @param logCount reactive getter for the log length (the growth signal)
 * @param isActive getter telling whether the run is still streaming
 */
export const useFollowBottom = (logCount: () => number, isActive: () => boolean) => {
  // Start following so a freshly opened, still-running run pins to its tail even
  // though the page loads scrolled to the top.
  const following = ref(true)

  const { arrivedState, directions, y } = useScroll(window, {
    onScroll: () => {
      if (directions.top) following.value = false // scrolled up → stop
      else if (arrivedState.bottom) following.value = true // back at bottom → resume
    }
  })

  // A wheel-up reaches us even when the page can't scroll (short page, or
  // data-fair's auto-height embed where the parent scrolls) — the only
  // "stop following" signal available there.
  useEventListener(window, 'wheel', (e: WheelEvent) => { if (e.deltaY < 0) following.value = false }, { passive: true })

  const pinToBottom = () => { y.value = (document.scrollingElement ?? document.documentElement).scrollHeight }

  watch(logCount, () => { if (isActive() && following.value) pinToBottom() }, { flush: 'post' })

  return { following }
}
