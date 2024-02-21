import config from 'config'
import axios from '@data-fair/lib/node/axios.js'
import debug from 'debug'
import { internalError } from '@data-fair/lib/node/observer.js'

export const send = async (notification) => {
  if (global.events) global.events.emit('notification', notification)
  debug('send notification', notification)
  if (!config.notifyUrl) {
    debug('no notifyUrl in config')
    return
  }
  if (process.env.NODE_ENV !== 'test') {
    await axios.post(`${config.privateNotifyUrl || config.notifyUrl}/api/v1/notifications`, notification, { params: { key: config.secretKeys.notifications } })
      .catch(err => {
        internalError('notif-send', 'Failure to push notification', notification, err.response || err)
      })
  }
}

export default { send }
