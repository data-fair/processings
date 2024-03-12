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

  /**
   * @typedef {Object} Filters
   * @property {Function} displayBytes
   * @property {Function} formatDate
   * @property {Function} fromNow
   * @property {Function} from
   */

  /** @type {Filters} */
  nuxtApp.vueApp.config.globalProperties.$filters = {
    /**
     * @param {String} aSize the size in bytes
     * @returns {String} the size in a human readable format
     */
    displayBytes: (aSize) => {
      const anIntSize = Math.abs(parseInt(aSize, 10))
      if (anIntSize === 0) return '0 octets'
      /** @type {[number, string][]} */
      const def = [[1, 'octets'], [1000, 'ko'], [1000 * 1000, 'Mo'], [1000 * 1000 * 1000, 'Go'], [1000 * 1000 * 1000 * 1000, 'To'], [1000 * 1000 * 1000 * 1000 * 1000, 'Po']]
      for (let i = 0; i < def.length; i++) {
        if (anIntSize < def[i][0]) return (anIntSize / def[i - 1][0]).toLocaleString() + ' ' + def[i - 1][1]
      }
      return ''
    },
    /**
     * @param {String} value the date to format
     * @param {String} format the format to use
     * @returns {String | undefined} the formatted date
     */
    date: (value, format = 'LLL') => {
      if (!value) return
      return dayjs(value).format(format)
    },
    /**
     * @param {String} value the date to format
     * @param {Boolean} acceptFuture if the date is in the future, should we accept it
     * @returns {String | undefined} the formatted date
     */
    fromNow: (value, acceptFuture = false) => {
      if (!value) return
      let date = dayjs(value)
      if (!acceptFuture) {
        const now = dayjs()
        date = date > now ? now : date
      }
      return date.locale('fr').fromNow()
    },
    /**
     * @param {[String, String]} array an array containing the start and end date
     * @returns {String} the time between the two dates
     */
    from: ([start, end]) => {
      return dayjs(start).locale('fr').from(dayjs(end), true)
    }
  }
})
