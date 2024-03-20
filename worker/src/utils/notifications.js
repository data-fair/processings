import config from '../config.js'
import axios from '@data-fair/lib/node/axios.js'
import debug from 'debug'
import { internalError } from '@data-fair/lib/node/observer.js'

const debugNotif = debug('notifications')
/**
 * @param {any} notification the notification to send
 * @returns {Promise<void>} nothing
 */
export const send = async (notification) => {
  // @test:spy("notificationSend", notification)
  debugNotif(`send notification ${notification}`)
  if (!config.notifyUrl) {
    debugNotif('no notifyUrl in config')
    return
  }
  if (process.env.NODE_ENV !== 'test') {
    await axios.post(`${config.notifyUrl}/api/v1/notifications`, notification, { params: { key: config.notificationsKeys } })
      .catch(err => {
        internalError('notif-send', 'Failure to push notification', notification, err.response || err)
        console.error('Failure to push notification', notification, err.response || err)
      })
  }
}

export default { send }
