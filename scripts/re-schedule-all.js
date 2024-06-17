const runs = require('../api/utils/runs')

async function main () {
  const { db } = await require('../api/utils/db').connect()
  for await (const processing of db.collection('processings').find()) {
    console.log('reschedule processing', processing._id)
    await runs.applyProcessing(db, processing)
  }
}

main().then(() => process.exit(), err => {
  console.error(err)
  process.exit(-1)
})
