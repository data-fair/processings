exports.description = 'Processings cannot have admin permissions any longer'

exports.exec = async (db, debug) => {
  const cursor = db.collection('processings').find({ 'permissions.profile': 'admin' })
  for await (const processing of cursor) {
    const permissions = processing.permissions.filter(p => p.profile !== 'admin')
    await db.collection('processings').updateOne({ id: processing.id }, { $set: { permissions } })
  }
}
