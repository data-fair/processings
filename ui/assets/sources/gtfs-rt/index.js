import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import { ofetch } from 'ofetch'

export async function run(config) {
  const result = await ofetch(config.url, { responseType: 'arrayBuffer' })
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(result)
  const bulkLines = feed.entity.filter(e => e.vehicle).map(e => {
    const v = JSON.parse(JSON.stringify(e.vehicle))
    return Object.assign({
      _id: v.vehicle.id,
      vehiculeId: v.vehicle.id,
      currentStopSequence: v.currentStopSequence,
      currentStatus: v.currentStatus,
      routeId: v.trip.routeId,
      dateTime: new Date(v.timestamp * 1000).toISOString()
    }, v.position)
  })
  return { bulkLines }
}
