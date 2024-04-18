/**
 * Converts scheduling object to a CRON expression.
 * @param {any} scheduling The scheduling object.
 * @returns {string} The CRON expression.
 */
export const toCRON = (scheduling) => {
  if (!scheduling || scheduling.type === 'manual') return 'Invalid CRON expression'
  const minute = scheduling.minute + (scheduling.minuteStep ? `/${scheduling.minuteStep}` : '')
  const hour = scheduling.hour + (scheduling.hourStep ? `/${scheduling.hourStep}` : '')
  const dayOfMonth = scheduling.dayOfMonth + (scheduling.dayOfMonthStep ? `/${scheduling.dayOfMonthStep}` : '')
  const month = scheduling.month + (scheduling.monthStep ? `/${scheduling.monthStep}` : '')
  const dayOfWeek = scheduling.dayOfWeek
  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
}
