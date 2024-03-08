// Etat des stations (position géographique et disponibilités) du service VLS Vélocéo de Vannes (GBFS)
//
// Le flux GBFS, mis à disposition par Smoove, présente la liste des stations du réseau
// de vélos en libre-service (VLS) Vélocéo de Vannes
import { ofetch } from 'ofetch'

export async function run(config) {
  const infos = await ofetch(config.infosUrl)
  const status = await ofetch(config.statusUrl)
  const stations = Object.assign({}, ...infos.data.stations.map(s => ({ [s.station_id]: s })))
  const updateDate = new Date(status.last_updated * 1000).toISOString()
  const bulkLines = status.data.stations
    .map(s => Object.assign({ update_date: updateDate }, s, stations[s.station_id])).filter(s => s.is_installed === 1)
  bulkLines.forEach(s => {
    s._id = s.station_id
    s.last_reported = new Date(s.last_reported).toISOString()
    s.is_renting = s.is_renting === 1
    s.is_returning = s.is_returning === 1
    delete s.is_installed
    // Deleting optional fields
    delete s.address
    delete s.num_bikes_disabled
    delete s.num_docks_disabled
  })
  return { bulkLines }
}
