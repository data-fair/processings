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
            <template #custom-time-zone="{value, disabled, on}">
              <time-zone-select
                :value="value"
                :disabled="disabled"
                v-on="on"
              />
            </template>
          </vjsf>
        </v-form>
        <processing-runs
          ref="runs"
          :processing="processing"
          class="mt-4"
          :can-exec="canExecProcessing"
        />
      </v-col>
      <layout-navigation-right v-if="$vuetify.display.lgAndUp">
        <processing-actions
          :processing="processing"
          :processing-schema="processingSchema"
          :can-admin="canAdminProcessing"
          :can-exec="canExecProcessing"
          :edited="edited"
          :is-small="false"
          @triggered="runs.refresh()"
        />
      </layout-navigation-right>
      <layout-actions-button
        v-else
        class="pt-2"
      >
        <template #actions>
          <processing-actions
            :processing="processing"
            :processing-schema="processingSchema"
            :can-admin="canAdminProcessing"
            :can-exec="canExecProcessing"
            :edited="edited"
            :is-small="true"
            @triggered="runs.refresh()"
          />
        </template>
      </layout-actions-button>
    </v-row>
  </v-container>
</template>

<script setup>
import '@koumoul/vjsf-markdown'
import contractProcessing from '../../../contract/processing'
import Vjsf from '@koumoul/vjsf'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '@data-fair/lib/vue/session.js'
import { v2compat } from '@koumoul/vjsf/compat/v2'

const route = useRoute()
const session = useSession()

const edited = ref(false)
/** @type {import('vue').Ref<import('../../../shared/types/index.js').processingType>} */
const editProcessing = ref(null)
/** @type {import('vue').Ref<import('../../../shared/types/index.js').processingType>} */
const processing = ref(null)
const plugin = ref(null)
const runs = ref(null)
const renderVjsfKey = ref(0)

const user = computed(() => session.state.user)

const canAdminProcessing = computed(() => {
  if (!processing.value) return false
  return processing.value.userProfile === 'admin'
})

const canExecProcessing = computed(() => {
  if (!processing.value) return false
  return ['admin', 'exec'].includes(processing.value.userProfile)
})

const processingSchema = computed(() => {
  if (!plugin.value || !processing.value) return
  const schema = JSON.parse(JSON.stringify(contractProcessing))
  Object.keys(schema.properties).forEach(key => {
    if (schema.properties[key].readOnly) {
      schema.required = schema.required.filter(k => k !== key)
      delete schema.properties[key]
    }
  })
  schema.properties.config = {
    ...plugin.value.processingConfigSchema,
    title: 'Plugin ' + plugin.value.fullName,
    'x-options': { deleteReadOnly: false }
  }
  if (user?.adminMode) delete schema.properties.debug?.readOnly
  if (!canAdminProcessing.value) {
    delete schema.properties.permissions
    delete schema.properties.config
    delete schema.properties.webhookKey
  }
  return v2compat(schema)
})

const vjsfOptions = computed(() => {
  if (!processing.value) return {}
  return {
    /*
    arrayItemCardProps: { outlined: true, tile: true },
    dialogCardProps: { outlined: true },
    dialogProps: {
      maxWidth: 500,
      overlayOpacity: 0 // better when inside an iframe
    },
    disableSorting: true,
    editMode: 'inline',
    expansionPanelsProps: {
      value: 0,
      hover: true
    },
    */
    context: {
      owner: processing.value.owner,
      dataFairUrl: window.location.origin + '/data-fair',
      directoryUrl: window.location.origin + '/simple-directory'
    },
    density: 'compact',
    readOnly: !canAdminProcessing.value,
    readOnlyPropertiesMode: 'remove'
  }
})

onMounted(async () => {
  await fetchProcessing()
  await fetchPlugin()
})

async function fetchProcessing() {
  processing.value = await $fetch(`/api/v1/processings/${route.params.id}`)
  editProcessing.value = { ...processing.value }
}

async function fetchPlugin() {
  if (processing.value && processing.value.plugin) {
    plugin.value = await $fetch(`/api/v1/plugins/${processing.value.plugin}`)
    Object.keys(processingSchema.value.properties).forEach(key => {
      if (processingSchema.value.properties[key].readOnly) delete editProcessing.value[key]
    })
  }
}

async function patch() {
  if (editProcessing.value.scheduling && editProcessing.value.scheduling.type === 'weekly') {
    if (editProcessing.value.scheduling.dayOfWeek === '*') editProcessing.value.scheduling.dayOfWeek = '1'
    renderVjsfKey.value += 1
  }
  edited.value = true
  await $fetch(`/api/v1/processings/${route.params.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...editProcessing.value })
  })
  edited.value = false
}
</script>
