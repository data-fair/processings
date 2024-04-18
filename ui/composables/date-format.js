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
   * @param {string} value the date to format
   * @param {string} format the format to use
   * @returns {string | undefined} the formatted date
   */
  function date (value, format = 'LLL') {
    if (!value) return
    return dayjs(value).format(format)
  }

  /**
   * @param {string} value the date to format
   * @param {boolean} acceptFuture if the date is in the future, should we accept it
   * @returns {string | undefined} the formatted date
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
   * @param {string} start the format to use
   * @param {string} end the format to use
   * @returns {string} the time between the two dates
   */
  function from (start, end) {
    return dayjs(start).locale('fr').from(dayjs(end), true)
  }

  return { date, fromNow, from }
}
