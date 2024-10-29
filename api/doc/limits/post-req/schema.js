import jsonSchema from '@data-fair/lib-utils/json-schema.js'
import LimitSchema from '#types/limit/schema.js'

export default {
  $id: 'https://github.com/data-fair/events/subscriptions/post-req',
  title: 'Post limit req',
  'x-exports': ['validate', 'types'],
  type: 'object',
  required: ['body'],
  properties: {
    body:
      jsonSchema(LimitSchema)
        .removeFromRequired(['id', 'type'])
        .removeId()
        .appendTitle(' post')
        .schema
  }
}
