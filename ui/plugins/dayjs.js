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

  nuxtApp.vueApp.config.globalProperties.$formatDate = (value, format = 'LLL') => {
    if (!value) return
    return dayjs(value).format(format)
  }

  nuxtApp.vueApp.config.globalProperties.$fromNow = (value, acceptFuture = false) => {
    if (!value) return
    let date = dayjs(value)
    if (!acceptFuture) {
      const now = dayjs()
      date = date > now ? now : date
    }
    return date.locale('fr').fromNow()
  }

  nuxtApp.vueApp.config.globalProperties.$from = ([start, end]) => {
    return dayjs(start).locale('fr').from(dayjs(end), true)
  }
})
