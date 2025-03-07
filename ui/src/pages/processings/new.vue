<template>
  <v-container
    data-iframe-height
    style="min-height:500px"
    class="pa-0"
    fluid
  >
    <v-stepper
      v-model="step"
      hide-actions
    >
      <v-stepper-header>
        <v-stepper-item
          title="Sélection du type de traitement"
          value="1"
          :color="step === '1' ? 'primary' : ''"
        />
        <v-divider />
        <v-stepper-item
          title="Informations"
          value="2"
          :color="step === '2' ? 'primary' : ''"
        />
      </v-stepper-header>

      <v-stepper-window>
        <v-stepper-window-item value="1">
          <v-row class="d-flex align-stretch">
            <v-col
              v-for="plugin in installedPlugins"
              :key="plugin.id"
              md="4"
              sm="6"
              cols="12"
            >
              <v-card
                class="h-100"
                :color="newProcessing.plugin === plugin.id ? 'primary' : ''"
                :prepend-icon="plugin.customIcon"
                :title="plugin.customName"
                @click="newProcessing.plugin = plugin.id; step = '2'"
              >
                <v-card-text>{{ plugin.description }}</v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-stepper-window-item>
        <v-stepper-window-item value="2">
          <v-text-field
            v-model="newProcessing.title"
            label="Titre"
          />
          <owner-pick
            v-model="newProcessing.owner"
            v-model:ready="ownersReady"
          />
          <v-btn
            :disabled="!ownersReady || !newProcessing.title || !newProcessing.plugin || inCreate"
            color="primary"
            @click="createProcessing()"
          >
            Créer
          </v-btn>
          <v-btn
            :disabled="inCreate"
            variant="text"
            @click="step = '1'"
          >
            Retour
          </v-btn>
        </v-stepper-window-item>
      </v-stepper-window>
    </v-stepper>
  </v-container>
</template>

<script setup lang="ts">
import OwnerPick from '@data-fair/lib-vuetify/owner-pick.vue'

type InstalledPlugin = {
  name: string
  customName: string
  customIcon: string
  description: string
  version: string
  distTag: string
  id: string
  pluginConfigSchema: any
  processingConfigSchema: any
}

const session = useSessionAuthenticated(() => new Error('Authentification nécessaire'))
const router = useRouter()

const owners = useStringsArraySearchParam('owner')
const owner = computed(() => {
  if (owners.value && owners.value.length) {
    const parts = owners.value[0].split(':')
    return { type: parts[0], id: parts[1] } as { type: 'user' | 'organization', id: string, department?: string }
  } else {
    return session.state.account
  }
})
const ownerFilter = computed(() => `${owner.value.type}:${owner.value.id}${owner.value.department ? ':' + owner.value.department : ''}`)

const installedPluginsFetch = useFetch<{ results: InstalledPlugin[], count: number }>(`${$apiPath}/plugins?privateAccess=${ownerFilter.value}`)
const installedPlugins = computed(() => installedPluginsFetch.data.value?.results)

const step = ref('1')
const inCreate = ref(false)
const showCreateMenu = ref(false)
const newProcessing: Ref<Record<string, string>> = ref({})
const ownersReady = ref(false)

const createProcessing = withUiNotif(
  async () => {
    inCreate.value = true

    const processing = await $fetch('/processings', {
      method: 'POST',
      body: JSON.stringify(newProcessing.value)
    })

    await router.push({ path: `/processings/${processing._id}` })
    showCreateMenu.value = false
    inCreate.value = false
  },
  'Erreur pendant la création du traitement',
  { msg: 'Traitement créé avec succès !' }
)

onMounted(() => {
  setBreadcrumbs([{
    text: 'Traitements',
    to: '/processings'
  }, {
    text: 'Créer un traitement'
  }])
})

</script>

<style scoped>
</style>
