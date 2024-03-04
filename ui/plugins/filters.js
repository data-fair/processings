import 'dayjs/locale/fr'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import { defineNuxtPlugin } from '#app'

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(duration)
dayjs.locale('fr')

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide('dayjs', dayjs)

  nuxtApp.vueApp.config.globalProperties.$filters = {
    displayBytes: (aSize) => {
      aSize = Math.abs(parseInt(aSize, 10))
      if (aSize === 0) return '0 octets'
      const def = [[1, 'octets'], [1000, 'ko'], [1000 * 1000, 'Mo'], [1000 * 1000 * 1000, 'Go'], [1000 * 1000 * 1000 * 1000, 'To'], [1000 * 1000 * 1000 * 1000 * 1000, 'Po']]
      for (let i = 0; i < def.length; i++) {
        if (aSize < def[i][0]) return (aSize / def[i - 1][0]).toLocaleString() + ' ' + def[i - 1][1]
      }
    },
    formatDate: (value, format = 'LLL') => {
      if (!value) return
      return dayjs(value).format(format)
    },
    fromNow: (value, acceptFuture = false) => {
      if (!value) return
      let date = dayjs(value)
      if (!acceptFuture) {
        const now = dayjs()
        date = date > now ? now : date
      }
      return date.locale('fr').fromNow()
    },
    from: ([start, end]) => {
      return dayjs(start).locale('fr').from(dayjs(end), true)
    }
  }
})