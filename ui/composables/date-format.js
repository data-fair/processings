import 'dayjs/locale/fr'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(duration)
dayjs.locale('fr')

export default function useDateFormat() {
  /**
   * @param {String} value the date to format
   * @param {String} format the format to use
   * @returns {String | undefined} the formatted date
   */
  function date (value, format = 'LLL') {
    if (!value) return
    return dayjs(value).format(format)
  }

  /**
   * @param {String} value the date to format
   * @param {Boolean} acceptFuture if the date is in the future, should we accept it
   * @returns {String | undefined} the formatted date
   */
  function fromNow (value, acceptFuture = false) {
    if (!value) return
    let date = dayjs(value)
    if (!acceptFuture) {
      const now = dayjs()
      date = date > now ? now : date
    }
    return date.locale('fr').fromNow()
  }

  /**
   * @param {String} start the format to use
   * @param {String} end the format to use
   * @returns {String} the time between the two dates
   */
  function from (start, end) {
    return dayjs(start).locale('fr').from(dayjs(end), true)
  }

  return { date, fromNow, from }
}
