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
        <v-defaults-provider :defaults="{global: { hideDetails: 'auto' }}">
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
        </v-defaults-provider>
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

import { resolvedSchema as contractProcessing } from '../../../../api/types/processing/index.ts'
import timeZones from 'timezones.json'
import Vjsf from '@koumoul/vjsf'
import { v2compat } from '@koumoul/vjsf/compat/v2'

const route = useRoute()
const session = useSession()
// const runtimeConfig = useRuntimeConfig()

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
  processing.value = await $fetch(`/processings/${processingId}`)
  if (processing.value) editProcessing.value = { ...processing.value }
}
async function fetchPlugin () {
  if (processing.value?.plugin) {
    plugin.value = await $fetch(`/plugins/${processing.value.plugin}`)
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

const processingSchema = computed(() => {
  if (!plugin.value || !processing.value) return
  const schema = JSON.parse(JSON.stringify(contractProcessing))
  delete schema.title
  schema.properties.config = {
    ...v2compat(plugin.value.processingConfigSchema),
    title: 'Plugin ' + plugin.value.customName
  }

  // merge processingConfigSchema $defs and definitions into the global Processing schema
  if (plugin.value.processingConfigSchema.$defs) {
    schema.$defs = { ...schema.$defs, ...plugin.value.processingConfigSchema.$defs }
    delete schema.properties.config.$defs
  }
  if (plugin.value.processingConfigSchema.definitions) {
    schema.definitions = { ...schema.definitions, ...plugin.value.processingConfigSchema.definitions }
    delete schema.properties.config.definitions
  }
  delete schema.properties.config.$id

  // remove readOnly properties for debug if in admin mode
  if (session.state.user?.adminMode) delete schema.properties.debug?.readOnly

  // remove configs for non-admin users
  if (!canAdminProcessing.value) {
    delete schema.properties.permissions
    delete schema.properties.config
    delete schema.required
  } else {
    schema.required = ['title', 'scheduling', 'config', 'permissions']
    schema.properties.config.required = schema.properties.config.required?.filter((s: any) => s !== 'datasetMode')
  }

  return schema
})

const vjsfOptions = computed(() => {
  return {
    context: {
      owner: processing.value?.owner,
      // ownerFilter: runtimeConfig.public.dataFairAdminMode ? `owner=${ownerFilter.value}` : '',
      ownerFilter: `owner=${processing.value?.owner.type}:${processing.value?.owner.id}${processing.value?.owner.department ? ':' + processing.value?.owner.department : ''}`,
      dataFairUrl: window.location.origin + $sitePath + '/data-fair',
      directoryUrl: window.location.origin + $sitePath + '/simple-directory',
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

    await $fetch(`/processings/${processingId}`, {
      method: 'PATCH',
      body: editProcessing.value
    })

    if (processing.value) Object.assign(processing.value, editProcessing.value)

    edited.value = false
  },
  "Erreur pendant l'enregistrement du traitement")

/*
  A patch can be triggered server side
*/
const patchConfigWSChannel = `processings/${processingId}/patch-config`
const ws = useWS('/processings/api/')
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
