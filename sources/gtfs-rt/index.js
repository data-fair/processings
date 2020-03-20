const GtfsRealtimeBindings = require('gtfs-realtime-bindings')
const axios = require('axios')

module.exports = async function(processing) {
  const result = await axios.get(processing.source.config.url, { responseType: 'arraybuffer' })
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(result.data)
  // console.log(feed.entity)
  const data = feed.entity.filter(e => e.vehicle).map(e => {
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
  return data
}
