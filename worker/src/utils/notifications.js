import config from 'config'
import axios from '@data-fair/lib/node/axios.js'
import debug from 'debug'
import { internalError } from '@data-fair/lib/node/observer.js'

export const send = async (notification) => {
  debug('send notification', notification)
  if (process.env.NODE_ENV !== 'test') {
    await axios.post(`${config.notifyUrl}/api/v1/notifications`, notification, { params: { key: config.notificationsKeys } })
      .catch(err => {
        internalError('notif-send', 'Failure to push notification', notification, err.response || err)
        console.error('Failure to push notification', notification, err.response || err)
      })
  }
}

export default { send }
