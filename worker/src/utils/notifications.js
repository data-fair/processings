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
  if (!config.privateNotifyUrl) {
    debugNotif('no privateNotifyUrl in config')
    return
  }
  if (process.env.NODE_ENV !== 'test') {
    await axios.post(`${config.privateNotifyUrl}/api/v1/notifications`, notification, { params: { key: config.secretKeys.notifications } })
      .catch(err => {
        internalError('notif-send', err, notification)
      })
  }
}

export default { send }
