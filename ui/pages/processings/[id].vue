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
        <v-form ref="form">
          <vjsf
            v-if="processingSchema"
            :key="renderVjsfKey"
            v-model="editProcessing"
            :schema="processingSchema"
            :options="vjsfOptions"
            @change="patch"
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
          :can-admin="canAdminProcessing"
          :can-exec="canExecProcessing"
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
            :can-admin="canAdminProcessing"
            :can-exec="canExecProcessing"
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
import { useStore } from '~/store/index'
import { v2compat } from '@koumoul/vjsf/compat/v2'

const store = useStore()
const route = useRoute()

/** @type {any} */
const editProcessing = ref(null)
/** @type {any} */
const form = ref(null)
/** @type {any} */
const processing = ref(null)
/** @type {any} */
const plugin = ref(null)
/** @type {any} */
const runs = ref(null)
const renderVjsfKey = ref(0)

const env = computed(() => store.env)
const user = computed(() => store.user)

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
  if (user.value.adminMode) delete schema.properties.debug?.readOnly
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
    arrayItemCardProps: { outlined: true, tile: true },
    context: {
      owner: processing.value.owner,
      ownerFilter: env.value.dataFairAdminMode ? `owner=${processing.value.owner.type}:${encodeURIComponent(processing.value.owner.id)}` : '',
      dataFairUrl: env.value.dataFairUrl,
      directoryUrl: env.value.directoryUrl
    },
    deleteReadOnly: true,
    density: 'compact',
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
    readOnly: !canAdminProcessing.value
  }
})

onMounted(async () => {
  if (route.query['back-link'] === 'true') {
    store.setAny({ runBackLink: true })
  }
  await fetchProcessing()
  await fetchPlugin()
})

async function fetchProcessing() {
  processing.value = await $fetch(`${env.value.publicUrl}/api/v1/processings/${route.params.id}`)
  store.setBreadcrumbs([{
    title: 'traitements',
    href: '/processings'
  }, {
    title: processing.value.title,
    disabled: false
  }])
  editProcessing.value = { ...processing.value }
}

async function fetchPlugin() {
  if (processing.value && processing.value.plugin) {
    plugin.value = await $fetch(`${env.value.publicUrl}/api/v1/plugins/${processing.value.plugin}`)
    Object.keys(processingSchema.value.properties).forEach(key => {
      if (processingSchema.value.properties[key].readOnly) delete editProcessing.value[key]
    })
  }
}

async function patch() {
  if (form.value && !form.value.validate()) return
  if (editProcessing.value.scheduling && editProcessing.value.scheduling.type === 'weekly') {
    if (editProcessing.value.scheduling.dayOfWeek === '*') editProcessing.value.scheduling.dayOfWeek = '1'
    renderVjsfKey.value += 1
  }
  await $fetch(`${env.value.publicUrl}/api/v1/processings/${route.params.id}`, {
    method: 'PATCH',
    body: { ...editProcessing.value }
  })
  await fetchProcessing()
}
</script>
