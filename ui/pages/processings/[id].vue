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
        <v-form>
          <vjsf
            v-if="processingSchema"
            :key="renderVjsfKey"
            v-model="editProcessing"
            :schema="processingSchema"
            :options="vjsfOptions"
            @update:model-value="patch()"
          >
            <template #custom-time-zone>
              <TimeZoneSelect
                :value="editProcessing?.config?.timeZone"
                @tzchange="handleTimeZoneChange"
              />
            </template>
          </vjsf>
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
import '@koumoul/vjsf-markdown'
import contractProcessing from '../../../contract/processing'
import useEventBus from '~/composables/event-bus'
import Vjsf from '@koumoul/vjsf'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '@data-fair/lib/vue/session.js'
import { v2compat } from '@koumoul/vjsf/compat/v2'

const eventBus = useEventBus()
const route = useRoute()
const session = useSession()

/** @typedef {import('../../../shared/types/processing/index.js').Processing} Processing */

const edited = ref(false)
/** @type {Ref<Processing|null>} */
const editProcessing = ref(null)
/** @type {Ref<Processing|null>} */
const processing = ref(null)
/** @type {Ref<Object<string, any>|null>} */
const plugin = ref(null)
/** @type {Ref<Record<string, any>|null>} */
const runs = ref(null)
const renderVjsfKey = ref(0)

const canAdminProcessing = computed(() => {
  if (!processing.value) return false
  return processing.value.userProfile === 'admin'
})

const canExecProcessing = computed(() => {
  if (!processing.value) return false
  return ['admin', 'exec'].includes(processing.value.userProfile || '')
})

/**
 * @param {Record<string, any>} object
 */
function updateCustomTimeZone(object) {
  Object.keys(object).forEach(key => {
    const value = object[key]

    if (value && typeof value === 'object') {
      updateCustomTimeZone(value)
    }

    if (key === 'x-display' && value === 'custom-time-zone') {
      object.layout = { slots: { component: 'custom-time-zone' } }
      delete object[key]
    }
  })
}

const processingSchema = computed(() => {
  if (!plugin.value || !processing.value) return
  const schema = JSON.parse(JSON.stringify(contractProcessing))
  Object.keys(schema.properties).forEach(key => {
    if (schema.properties[key].readOnly) {
      schema.required = schema.required.filter((/** @type {string} */k) => k !== key)
      delete schema.properties[key]
    }
  })
  updateCustomTimeZone(schema)
  schema.properties.config = {
    ...plugin.value.processingConfigSchema,
    title: 'Plugin ' + plugin.value.customName,
    'x-options': { deleteReadOnly: false }
  }
  if (session.state.user?.adminMode) delete schema.properties.debug?.readOnly
  if (!canAdminProcessing.value) {
    delete schema.properties.permissions
    delete schema.properties.config
    delete schema.properties.webhookKey
  }
  return v2compat(schema)
})

const vjsfOptions = computed(() => {
  return {
    context: {
      owner: processing.value?.owner,
      dataFairUrl: window.location.origin + '/data-fair',
      directoryUrl: window.location.origin + '/simple-directory'
    },
    debounceInputMs: 1000,
    density: 'comfortable',
    initialValidation: 'withData',
    readOnly: !canAdminProcessing.value,
    readOnlyPropertiesMode: 'remove',
    updateOn: 'blur',
    validateOn: 'blur'
  }
})

onMounted(async () => {
  await fetchProcessing()
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

/**
 * @param {string} value
 */
async function handleTimeZoneChange(value) {
  if (editProcessing.value?.config) editProcessing.value.config.timeZone = value
  await patch()
}

async function patch() {
  if (editProcessing.value?.scheduling && editProcessing.value.scheduling.type === 'weekly') {
    if (editProcessing.value.scheduling.dayOfWeek === '*') editProcessing.value.scheduling.dayOfWeek = '1'
    renderVjsfKey.value += 1
  }
  edited.value = true
  try {
    await $fetch(`/api/v1/processings/${route.params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...editProcessing.value })
    })
  } catch (error) {
    console.error(error)
    eventBus.emit('notification', { error, msg: 'Erreur pendant la modification du traitement' })
  } finally {
    edited.value = false
  }
}

</script>

<style>
</style>
