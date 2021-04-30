exports.description = 'Remove deprecated mongodb index'

exports.exec = async (db, debug) => {
  db.collection('processings').dropIndex('id_1')
}
