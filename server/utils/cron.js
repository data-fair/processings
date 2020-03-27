module.exports.fromScheduling = function(scheduling) {
  if (!scheduling) return '0 0 */1 * *'
  if (scheduling.unit === 'days') return `0 ${scheduling.offset.hours} ${scheduling.offset.days}/${scheduling.interval} * *`
  else if (scheduling.unit === 'hours') return `${scheduling.offset.minutes} ${scheduling.offset.hours}/${scheduling.interval} * * *`
  else if (scheduling.unit === 'minutes') return `${scheduling.offset.seconds} ${scheduling.offset.minutes}/${scheduling.interval} * * * *`
  else return `${scheduling.offset.seconds}/${scheduling.interval} * * * * *`
}
