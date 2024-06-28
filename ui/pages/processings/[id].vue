<template>
  <v-container
    v-if="processing"
    data-iframe-height
  >
    <v-row>
      <v-col>
        <h2 class="text-h6">
          Traitement {{ processing.title }}
        </h2>
        <v-form
          v-model="valid"
          autocomplete="off"
        >
          <vjsf
            v-if="processingSchema"
            v-model="editProcessing"
            :schema="processingSchema"
            :options="vjsfOptions"
            @update:model-value="patch()"
          />
        </v-form>
        <processing-runs
          ref="runs"
          :can-exec="canExecProcessing"
          :processing="processing"
          class="mt-4"
        />
      </v-col>
      <LayoutNavigationRight
        v-if="$vuetify.display.lgAndUp"
      >
        <ProcessingActions
          :processing="processing"
          :processing-schema="processingSchema"
          :can-admin="canAdminProcessing"
          :can-exec="canExecProcessing"
          :edited="edited"
          :is-small="false"
          @triggered="runs && runs.refresh()"
        />
      </LayoutNavigationRight>
      <LayoutActionsButton
        v-else
      >
        <template #actions>
          <ProcessingActions
            :processing="processing"
            :processing-schema="processingSchema"
            :can-admin="canAdminProcessing"
            :can-exec="canExecProcessing"
            :edited="edited"
            :is-small="true"
            @triggered="runs && runs.refresh()"
          />
        </template>
      </LayoutActionsButton>
    </v-row>
  </v-container>
</template>

<script setup>
import timeZones from 'timezones.json'
import setBreadcrumbs from '~/utils/breadcrumbs'
import contractProcessing from '../../../contract/processing'
import Vjsf from '@koumoul/vjsf'
import VjsfMarkdown from '@koumoul/vjsf-markdown'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '@data-fair/lib/vue/session.js'
import { v2compat } from '@koumoul/vjsf/compat/v2'
import useEventBus from '~/composables/event-bus'

const route = useRoute()
const session = useSession()
const eventBus = useEventBus()

/** @typedef {import('../../../shared/types/processing/index.js').Processing} Processing */

/** @type {string[]} */
const utcs = []
for (const tz of timeZones) {
  for (const utc of tz.utc) {
    if (!utcs.includes(utc)) utcs.push(utc)
  }
}

const valid = ref(false)
const edited = ref(false)
/** @type {Ref<Processing|null>} */
const editProcessing = ref(null)
/** @type {Ref<Processing|null>} */
const processing = ref(null)
/** @type {Ref<Record<string, any>|null>} */
const plugin = ref(null)
/** @type {Ref<Record<string, any>|null>} */
const runs = ref(null)

/*
Fetch initial data
*/

onMounted(async () => {
  await fetchProcessing()
  setBreadcrumbs([{
    text: 'traitements',
    to: '/processings'
  }, {
    text: processing.value?.title || ''
  }])
  await fetchPlugin()
})

async function fetchProcessing() {
  processing.value = await $fetch(`/api/v1/processings/${route.params.id}`)
  if (processing.value) editProcessing.value = { ...processing.value }
}
async function fetchPlugin() {
  if (processing.value?.plugin) {
    plugin.value = await $fetch(`/api/v1/plugins/${processing.value.plugin}`)
  }
}

/*
Permissions
*/

const canAdminProcessing = computed(() => {
  if (!processing.value) return false
  return processing.value.userProfile === 'admin'
})
const canExecProcessing = computed(() => {
  if (!processing.value) return false
  return ['admin', 'exec'].includes(processing.value.userProfile || '')
})

/*
Preparation for the vjsf form
*/

/**
 * @param {Record<string, any>} object
 */
function recurseConfigSchema(object) {
  Object.keys(object).forEach(key => {
    const value = object[key]
    if (key === 'props' && value?.type === 'password') {
      value.autocomplete = 'new-password'
    }
    if (value && typeof value === 'object') {
      recurseConfigSchema(value)
    }
  })
}

const processingSchema = computed(() => {
  if (!plugin.value || !processing.value) return
  const schema = JSON.parse(JSON.stringify(contractProcessing))
  schema.properties.config = {
    ...plugin.value.processingConfigSchema,
    title: 'Plugin ' + plugin.value.customName,
    'x-options': { deleteReadOnly: false }
  }
  if (plugin.value.processingConfigSchema.$defs) {
    schema.$defs = { ...schema.$defs, ...plugin.value.processingConfigSchema.$defs }
    delete schema.properties.config.$defs
  }
  if (plugin.value.processingConfigSchema.definitions) {
    schema.definitions = { ...schema.definitions, ...plugin.value.processingConfigSchema.definitions }
    delete schema.properties.config.definitions
  }
  if (session.state.user?.adminMode) delete schema.properties.debug?.readOnly
  if (!canAdminProcessing.value) {
    delete schema.properties.permissions
    delete schema.properties.config
    delete schema.properties.webhookKey
    schema.properties.title.layout = 'none'
  } else {
    schema.required.push('config')
  }
  Object.keys(schema.properties).forEach(key => {
    if (schema.properties[key].readOnly) {
      schema.required = schema.required.filter((/** @type {string} */k) => k !== key)
      delete schema.properties[key]
    }
  })
  const cleanSchema = v2compat(schema)
  recurseConfigSchema(cleanSchema)
  if (cleanSchema.properties.config?.required) {
    cleanSchema.properties.config.required = cleanSchema.properties.config.required
      .filter((/** @type {string} */s) => s !== 'datasetMode')
  }
  return cleanSchema
})

const vjsfOptions = computed(() => {
  /** @type {import('@koumoul/vjsf').Options} */
  return {
    plugins: [VjsfMarkdown],
    context: {
      owner: processing.value?.owner,
      dataFairUrl: window.location.origin + '/data-fair',
      directoryUrl: window.location.origin + '/simple-directory',
      utcs
    },
    density: 'compact',
    initialValidation: 'always',
    readOnly: !canAdminProcessing.value,
    readOnlyPropertiesMode: 'remove',
    removeAdditional: true,
    updateOn: 'blur',
    validateOn: 'blur',
    locale: 'fr',
    titleDepth: 3
  }
})

let initialPatch = true
async function patch() {
  // the first patch is always triggered becaure of removed additional properties
  if (initialPatch) {
    initialPatch = false
    return
  }

  // TODO: some problem in vjsf makes it necessary to wait when adding a permission for validity to be correct
  await new Promise(resolve => setTimeout(resolve, 1))

  if (!valid.value || !canAdminProcessing.value) return
  edited.value = true
  if (editProcessing.value?.scheduling && editProcessing.value.scheduling.type === 'weekly') {
    if (editProcessing.value.scheduling.dayOfWeek === '*') editProcessing.value.scheduling.dayOfWeek = '1'
  }
  try {
    await $fetch(`/api/v1/processings/${route.params.id}`, {
      method: 'PATCH',
      body: editProcessing.value
    })
    if (processing.value) Object.assign(processing.value, editProcessing.value)
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant l\'enregistrement du traitement' })
  } finally {
    edited.value = false
  }
}

/*
A patch can be triggered server side
*/

const patchConfigWSChannel = `processings/${route.params.id}/patch-config`
const onPatchConfig = () => {
  fetchProcessing()
}
onMounted(() => {
  eventBus.emit('subscribe', patchConfigWSChannel)
  eventBus.on(patchConfigWSChannel, onPatchConfig)
})
onUnmounted(() => {
  eventBus.emit('unsubscribe', patchConfigWSChannel)
  eventBus.off(patchConfigWSChannel, onPatchConfig)
})

</script>

<style>
</style>
