import type { Notification } from '@data-fair/lib-common-types/notification'
import { internalError } from '@data-fair/lib-node/observer.js'
import axios from '@data-fair/lib-node/axios.js'
import config from '#config'
import debug from 'debug'

const debugNotif = debug('notifications')

export const send = async (notification: Notification) => {
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
