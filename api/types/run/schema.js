export default {
  $id: 'https://github.com/data-fair/processings/run',
  'x-exports': [
    'types',
    'validate'
  ],
  title: 'run',
  type: 'object',
  additionalProperties: true,
  required: [
    '_id',
    'owner',
    'processing',
    'createdAt',
    'status',
    'log'
  ],
  properties: {
    _id: {
      type: 'string'
    },
    owner: {
      $ref: 'https://github.com/data-fair/lib/account'
    },
    processing: {
      type: 'object',
      additionalProperties: false,
      required: [
        '_id',
        'title'
      ],
      properties: {
        _id: {
          type: 'string'
        },
        title: {
          type: 'string'
        }
      }
    },
    createdAt: {
      type: 'string',
      format: 'date-time'
    },
    status: {
      type: 'string',
      enum: [
        'triggered',
        'scheduled',
        'running',
        'error',
        'finished',
        'kill',
        'killed'
      ]
    },
    scheduledAt: {
      type: 'string',
      format: 'date-time'
    },
    startedAt: {
      type: 'string',
      format: 'date-time'
    },
    finishedAt: {
      type: 'string',
      format: 'date-time'
    },
    log: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'step',
              'error',
              'warning',
              'info',
              'debug'
            ]
          },
          date: {
            type: 'string',
            format: 'date-time'
          },
          msg: {
            type: 'string'
          },
          extra: {
            type: 'object'
          }
        }
      }
    },
    permissions: {
      type: 'array',
      items: {
        $ref: 'https://github.com/data-fair/processings/permission'
      }
    }
  }
}
