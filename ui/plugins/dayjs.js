import Vue from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
// import 'dayjs/locale/en'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import duration from 'dayjs/plugin/duration'
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(duration)

Vue.prototype.$dayjs = dayjs

Vue.filter('date', (value, format = 'LLL') => {
  if (!value) return
  return dayjs(value).format(format)
})

Vue.filter('fromNow', (value, acceptFuture = false) => {
  if (!value) return
  // prevent showing date in the future, can happen in case of small clock mismatch
  let date = dayjs(value)
  if (!acceptFuture) {
    const now = dayjs()
    date = date > now ? now : date
  }
  return date.locale('fr').fromNow()
})

Vue.filter('from', ([start, end]) => {
  return dayjs(start).locale('fr').from(dayjs(end), true)
})

export default async ({ app }) => {
  /* TODO: uncomment when working on i18n
  dayjs.locale(app.i18n.locale)
  app.i18n.onLanguageSwitched = (oldLocale, newLocale) => {
    dayjs.locale(newLocale)
  } */
  dayjs.locale('fr')
}
