const express = require('express')
// const config = require('config')
// const eventToPromise = require('event-to-promise')
// const asyncWrap = require('./utils/async-wrap')

const api = module.exports = express.Router()

api.use('/processings', require('./routers/processings'))

//
// api.get('/directories', asyncWrap(async(req, res) => {
//   const klawStream = klaw(config.backupDir, { queueMethod: 'pop' })
//   let rootDir, currentDir
//   const dirs = []
//   klawStream.on('data', item => {
//     if (item.stats.isDirectory()) {
//       if (rootDir) {
//         currentDir = { path: item.path.replace(rootDir, ''), children: [] }
//         dirs.push(currentDir)
//       } else {
//         rootDir = item.path
//       }
//     } else {
//       currentDir.children.push({ path: item.path.replace(rootDir, ''), size: prettyBytes(item.stats.size) })
//     }
//   })
//   await eventToPromise(klawStream, 'end')
//   res.send(dirs)
// }))
//
// api.use('/directories/', express.static(config.backupDir))
