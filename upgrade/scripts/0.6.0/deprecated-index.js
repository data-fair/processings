exports.description = 'Remove deprecated mongodb index'

exports.exec = async (db, debug) => {
  try {
    await db.collection('processings').dropIndex('id_1')
  } catch(err) {
    // nothing to do
  }
}
