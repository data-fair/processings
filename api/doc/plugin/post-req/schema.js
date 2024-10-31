import jsonSchema from '@data-fair/lib-utils/json-schema.js'
import PluginSchema from '#types/plugin/schema.js'

export default {
  $id: 'https://github.com/data-fair/processings/plugin/post-req',
  title: 'Post processing req',
  'x-exports': ['validate', 'types'],
  type: 'object',
  required: ['body'],
  properties: {
    body:
      jsonSchema(PluginSchema)
        .pickProperties(['distTag', 'name', 'version'])
        .removeId()
        .appendTitle(' post')
        .schema
  }
}
