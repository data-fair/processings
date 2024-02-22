export default function (scheduling) {
  if (scheduling.unit === 'trigger') return 'Déclenchement manuel'
  let str = (scheduling.unit === 'days' ? 'Tous' : 'Toutes') + ' les ' + (scheduling.interval > 1 ? (scheduling.interval + ' ') : '')
  if (scheduling.unit === 'seconds') str += 'secondes'
  if (scheduling.unit === 'minutes') str += 'minutes'
  if (scheduling.unit === 'hours') str += 'heures'
  if (scheduling.unit === 'days') str += 'jours'
  return str
}
