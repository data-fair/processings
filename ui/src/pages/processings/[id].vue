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
      <layout-navigation-right v-if="$vuetify.display.lgAndUp">
        <processing-actions
          :processing="processing"
          :processing-schema="processingSchema"
          :can-admin="canAdminProcessing"
          :can-exec="canExecProcessing"
          :edited="edited"
          :is-small="false"
          @triggered="runs && runs.refresh()"
        />
      </layout-navigation-right>
      <layout-actions-button v-else>
        <template #actions>
          <processing-actions
            :processing="processing"
            :processing-schema="processingSchema"
            :can-admin="canAdminProcessing"
            :can-exec="canExecProcessing"
            :edited="edited"
            :is-small="true"
            @triggered="runs && runs.refresh()"
          />
        </template>
      </layout-actions-button>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { Plugin, Processing } from '#api/types'

import timeZones from 'timezones.json'
import contractProcessing from '../../../contract/processing'
import Vjsf from '@koumoul/vjsf'
import VjsfMarkdown from '@koumoul/vjsf-markdown'
import { v2compat } from '@koumoul/vjsf/compat/v2'

const route = useRoute()
const session = useSession()
const runtimeConfig = useRuntimeConfig()

const processingId = (route.params as { id: string }).id
const utcs: string[] = []
for (const tz of timeZones) {
  for (const utc of tz.utc) {
    if (!utcs.includes(utc)) utcs.push(utc)
  }
}

const valid = ref(false)
const edited = ref(false)
const editProcessing: Ref<Processing | null> = ref(null)
const processing: Ref<Processing | null> = ref(null)
const plugin: Ref<Plugin | null> = ref(null)
const runs: Ref<Record<string, any>> = ref([])

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

async function fetchProcessing () {
  processing.value = await $fetch(`${$apiPath}/processings/${processingId}`)
  if (processing.value) editProcessing.value = { ...processing.value }
}
async function fetchPlugin () {
  if (processing.value?.plugin) {
    plugin.value = await $fetch(`${$apiPath}/plugins/${processing.value.plugin}`)
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

function recurseConfigSchema (object: Record<string, any>) {
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
      schema.required = schema.required.filter((k: any) => k !== key)
      delete schema.properties[key]
    }
  })
  const cleanSchema = v2compat(schema)
  recurseConfigSchema(cleanSchema)
  if (cleanSchema.properties.config?.required) {
    cleanSchema.properties.config.required = cleanSchema.properties.config.required
      .filter((s: any) => s !== 'datasetMode')
  }
  return cleanSchema
})

const owner = computed(() => processing.value?.owner)
const ownerFilter = computed(() => `${owner.value?.type}:${owner.value?.id}${owner.value?.department ? ':' + owner.value?.department : ''}`)

const vjsfOptions = computed(() => {
  return {
    plugins: [VjsfMarkdown],
    context: {
      owner: processing.value?.owner,
      ownerFilter: runtimeConfig.public.dataFairAdminMode ? `owner=${ownerFilter.value}` : '',
      dataFairUrl: window.location.origin + '/data-fair',
      directoryUrl: window.location.origin + '/simple-directory',
      utcs
    },
    density: 'comfortable',
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
const patch = withUiNotif(
  async () => {
    // the first patch is always triggered because of removed additional properties
    if (initialPatch) {
      initialPatch = false
      return
    }

    // TODO: some problem in vjsf makes it necessary to wait when adding a permission for validity to be correct
    await new Promise(resolve => setTimeout(resolve, 1))

    if (!valid.value || !canAdminProcessing.value) return
    edited.value = true

    await $fetch(`${$apiPath}/processings/${processingId}`, {
      method: 'PATCH',
      body: editProcessing.value
    })

    if (processing.value) Object.assign(processing.value, editProcessing.value)

    edited.value = false
  },
  "Erreur pendant l'enregistrement du traitement",
  { msg: 'Traitement enregistré avec succès !' }
)

/*
  A patch can be triggered server side
*/

const patchConfigWSChannel = `processings/${processingId}/patch-config`
const ws = useWS('/processings')
const onPatchConfig = () => {
  fetchProcessing()
}
onMounted(() => {
  ws?.subscribe(patchConfigWSChannel, onPatchConfig)
})
onUnmounted(() => {
  ws?.unsubscribe(patchConfigWSChannel, onPatchConfig)
})

</script>

<style>
</style>
