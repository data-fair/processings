<template>
  <v-container
    v-if="processing"
    data-iframe-height
  >
    <v-row>
      <v-col :style="$vuetify.display.lgAndUp ? 'padding-right:256px;' : ''">
        <h2 class="text-h6">
          Traitement {{ processing.title }}
        </h2>
        <v-form ref="form">
          <v-jsf
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
          </v-jsf>
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
          @triggered="$refs.runs.refresh()"
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
            @triggered="$refs.runs.refresh()"
          />
        </template>
      </layout-actions-button>
    </v-row>
  </v-container>
</template>

<script setup>
import * as contractProcessing from '../../../contract/processing'
import Vjsf from '@koumoul/vjsf'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from '~/store/index'

const form = ref(null)
const store = useStore()
const route = useRoute()

const processing = ref(null)
const editProcessing = ref(null)
const plugin = ref(null)
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
  schema.properties.config = {
    ...plugin.value.processingConfigSchema,
    title: 'Plugin ' + plugin.value.fullName,
    'x-options': { deleteReadOnly: false }
  }
  if (user.value.adminMode) delete schema.properties.debug.readOnly
  if (!canAdminProcessing.value) {
    delete schema.properties.permissions
    delete schema.properties.config
    delete schema.properties.webhookKey
  }
  return schema
})

const vjsfOptions = computed(() => {
  if (!processing.value) return
  return {
    context: {
      owner: processing.value.owner,
      ownerFilter: env.value.dataFairAdminMode ? `owner=${processing.value.owner.type}:${encodeURIComponent(processing.value.owner.id)}` : '',
      dataFairUrl: env.value.dataFairUrl,
      directoryUrl: env.value.directoryUrl
    },
    disableAll: !canAdminProcessing.value,
    // locale: 'fr',
    // rootDisplay: 'expansion-panels',
    // rootDisplay: 'tabs',
    expansionPanelsProps: {
      value: 0,
      hover: true
    },
    dialogProps: {
      maxWidth: 500,
      overlayOpacity: 0 // better when inside an iframe
    },
    arrayItemCardProps: { outlined: true, tile: true },
    dialogCardProps: { outlined: true },
    deleteReadOnly: true,
    editMode: 'inline',
    disableSorting: true
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
    text: 'traitements',
    to: '/processings'
  }, {
    text: processing.value.title
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
