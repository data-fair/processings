exports.description = 'Processings cannot have admin permissions any longer'

exports.exec = async (db, debug) => {
  for await (const processing of db.collection('processings').find({ 'permissions.profile': 'admin' })) {
    const permissions = processing.permissions.filter(p => p.profile !== 'admin')
    debug('clean permissions of processing', processing._id, processing.title, processing.permissions)
    await db.collection('processings').updateOne({ _id: processing._id }, { $set: { permissions } })
  }

  for await (const processing of db.collection('processings').find({ 'lastRun.permissions.profile': 'admin' })) {
    const permissions = processing.lastRun.permissions.filter(p => p.profile !== 'admin')
    debug('clean permissions of processing.lastRun', processing._id, processing.title, processing.lastRun)
    await db.collection('processings').updateOne({ _id: processing._id }, { $set: { 'lastRun.permissions': permissions } })
  }

  for await (const run of db.collection('runs').find({ 'permissions.profile': 'admin' })) {
    const permissions = run.permissions.filter(p => p.profile !== 'admin')
    debug('clean permissions of processing', run._id, run.permissions)
    await db.collection('runs').updateOne({ _id: run._id }, { $set: { permissions } })
  }
}
