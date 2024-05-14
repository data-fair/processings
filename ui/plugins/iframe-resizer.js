import 'iframe-resizer/js/iframeResizer.contentWindow'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(nuxtApp => {
  globalThis.iFrameResizer = {
    heightCalculationMethod: 'taggedElement'
  }
})
