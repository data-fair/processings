const { owner } = require('./owner')

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['_id', 'owner', 'processing', 'createdAt', 'status', 'log'],
  properties: {
    _id: { type: 'string' },
    owner,
    processing: {
      type: 'object',
      additionalProperties: false,
      required: ['_id', 'title'],
      properties: {
        _id: { type: 'string' },
        title: { type: 'string' },
      },
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    status: {
      type: 'string',
      enum: ['triggered', 'scheduled', 'running', 'stopped', 'error', 'finished'],
    },
    scheduledAt: {
      type: 'string',
      format: 'date-time',
    },
    startedAt: {
      type: 'string',
      format: 'date-time',
    },
    finishedAt: {
      type: 'string',
      format: 'date-time',
    },
    log: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['step', 'error', 'warning', 'info', 'debug'],
          },
          date: {
            type: 'string',
            format: 'date-time',
          },
          msg: {
            type: 'string',
          },
          extra: {
            type: 'object',
          },
        },
      },
    },
  },
}
