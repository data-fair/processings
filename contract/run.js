const { owner } = require('./owner')

module.exports = {
  _id: { type: 'string' },
  owner,
  processing: {
    _id: { type: 'string' },
    title: { type: 'string' },
  },
  status: {
    type: 'string',
    enum: ['scheduled', 'running', 'cancelled', 'error'],
  },
  scheduledAt: {
    type: 'string',
    format: 'date-time',
  },
  log: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['step', 'info', 'debug'],
        },
      },
    },
  },
}
