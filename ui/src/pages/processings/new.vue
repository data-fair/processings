<template>
  <v-container
    data-iframe-height
    style="min-height:500px"
    class="pa-0"
    fluid
  >
    <v-stepper
      v-model="step"
      style="background-color: transparent"
      flat
    >
      <v-stepper-header>
        <v-stepper-item
          :title="t('selectPluginType')"
          value="1"
          :color="step === '1' ? 'primary' : ''"
          :complete="!!newProcessing.pluginId"
          editable
        />
        <v-divider />
        <v-stepper-item
          :title="t('information')"
          value="2"
          :color="step === '2' ? 'primary' : ''"
          :editable="!!newProcessing.pluginId"
        />
      </v-stepper-header>

      <v-stepper-window>
        <v-stepper-window-item value="1">
          <v-text-field
            v-model="search"
            :label="t('searchPlugin')"
            density="compact"
            variant="outlined"
            clearable
            class="mb-4"
            hide-details
            prepend-inner-icon="mdi-magnify"
          />
          <div
            v-for="group in orderedGroups"
            :key="group"
            class="mb-4"
          >
            <template v-if="groupedArtefacts[group]?.length">
              <h3 class="text-h6 mb-2">
                {{ group }}
              </h3>
              <v-row class="d-flex align-stretch">
                <v-col
                  v-for="artefact in groupedArtefacts[group]"
                  :key="artefact._id"
                  md="3"
                  sm="4"
                  cols="12"
                >
                  <v-card
                    class="h-100"
                    :color="isPicked(artefact) ? 'primary' : ''"
                    @click="pickPlugin(artefact)"
                  >
                    <template #title>
                      <span :class="!isPicked(artefact) ? 'text-primary' : ''">
                        {{ artefactDisplayName(artefact) }}
                      </span>
                    </template>
                    <template
                      v-if="artefact.thumbnail"
                      #prepend
                    >
                      <v-avatar
                        size="32"
                        :image="`/registry/api/v1/thumbnails/${artefact.thumbnail.id}/data`"
                      />
                    </template>
                    <v-card-text>{{ artefactDisplayDescription(artefact) }}</v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </template>
          </div>
          <v-alert
            v-if="!filteredArtefacts.length && !installedPluginsFetch.loading.value"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            {{ search ? t('noMatch') : t('noPlugins') }}
          </v-alert>
        </v-stepper-window-item>
        <v-stepper-window-item value="2">
          <v-text-field
            v-model="newProcessing.title"
            :label="t('title')"
            hide-details
          />
          <owner-pick
            v-model="newProcessing.owner"
            v-model:ready="ownersReady"
          />
        </v-stepper-window-item>
      </v-stepper-window>

      <v-stepper-actions
        v-if="step !== '1'"
        :prev-text="t('previous')"
        @click:prev="step = '1'"
      >
        <template #next>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!ownersReady || !newProcessing.title || !newProcessing.pluginId"
            :loading="createProcessing.loading.value"
            @click="createProcessing.execute()"
          >
            {{ t('create') }}
          </v-btn>
        </template>
      </v-stepper-actions>
    </v-stepper>
  </v-container>
</template>

<script setup lang="ts">
import OwnerPick from '@data-fair/lib-vuetify/owner-pick.vue'

// Subset of registry's Artefact shape that the picker actually uses. Kept
// inline to avoid importing the registry types into processings.
// Artefacts are keyed by package name (no @major); `latestMajor` is the
// pin we apply when creating a new processing.
type RegistryArtefact = {
  _id: string
  name: string
  latestMajor?: number
  category: string
  title?: { fr?: string, en?: string }
  description?: { fr?: string, en?: string }
  group?: { fr?: string, en?: string }
  thumbnail?: { id: string, width: number, height: number }
}

type NewProcessing = {
  title?: string
  owner?: { type: 'user' | 'organization', id: string, department?: string }
  pluginId?: string
}

const { t, locale } = useI18n()
const session = useSessionAuthenticated(() => new Error('Authentification nécessaire'))
const router = useRouter()

/*
  Permissions
*/
const owners = useStringsArraySearchParam('owner')
const owner = computed(() => {
  if (owners.value && owners.value.length) {
    const parts = owners.value[0].split(':')
    return { type: parts[0], id: parts[1] } as { type: 'user' | 'organization', id: string, department?: string }
  } else {
    return session.state.account
  }
})
const ownerRole = computed(() => {
  const user = session.state.user
  if (owner.value.type === 'user') {
    if (owner.value.id === user.id) return 'admin'
    else return 'anonymous'
  }
  const userOrg = user.organizations.find(o => {
    if (o.id !== owner.value.id) return false
    if (!o.department) return true
    if (o.department === owner.value.department) return true
    return false
  })
  return userOrg ? userOrg.role : 'anonymous'
})
const canAdmin = computed(() => ownerRole.value === 'admin' || !!session.state.user?.adminMode)
if (!canAdmin.value) throw new Error(t('noPermission'))

// Registry sits on the same domain at /registry — same-origin call, the
// SimpleDirectory session cookie is sent automatically. Filtered server-side
// to processing-category artefacts the calling account can see.
const installedPluginsFetch = useFetch<{ results: RegistryArtefact[], count: number }>(
  '/registry/api/v1/artefacts',
  { query: { category: 'processing', size: 100 } }
)
const installedPlugins = computed(() => installedPluginsFetch.data.value?.results ?? [])

const search = ref('')
const filteredArtefacts = computed(() => {
  const q = search.value?.trim().toLowerCase()
  if (!q) return installedPlugins.value
  return installedPlugins.value.filter(a =>
    a.name.toLowerCase().includes(q) ||
    artefactDisplayName(a).toLowerCase().includes(q) ||
    (artefactDisplayDescription(a) ?? '').toLowerCase().includes(q)
  )
})

const artefactDisplayName = (a: RegistryArtefact) =>
  a.title?.[locale.value as 'fr' | 'en'] ?? a.title?.fr ?? a.title?.en ?? a.name
const artefactDisplayDescription = (a: RegistryArtefact) =>
  a.description?.[locale.value as 'fr' | 'en'] ?? a.description?.fr ?? a.description?.en ?? ''
const artefactGroup = (a: RegistryArtefact) =>
  a.group?.[locale.value as 'fr' | 'en'] ?? a.group?.fr ?? a.group?.en ?? t('otherGroup')

// Configured group order, with a trailing fallback bucket for ungrouped or
// unknown groups. Empty buckets are hidden by the template.
const orderedGroups = computed(() => [...$uiConfig.pluginCategories, t('otherGroup')])
const groupedArtefacts = computed(() => {
  const buckets: Record<string, RegistryArtefact[]> = {}
  for (const group of orderedGroups.value) buckets[group] = []
  for (const artefact of filteredArtefacts.value) {
    const group = artefactGroup(artefact)
    if (!buckets[group]) buckets[group] = []
    buckets[group].push(artefact)
  }
  return buckets
})

const step = ref('1')
const showCreateMenu = ref(false)
const newProcessing = ref<NewProcessing>({})
const ownersReady = ref(false)

const pickPlugin = (artefact: RegistryArtefact) => {
  // Pin to the artefact's current major; registry resolves to the latest
  // minor.patch on every run. Older majors are still resolvable from old
  // processings but are not surfaced in the picker.
  if (artefact.latestMajor === undefined) return
  newProcessing.value.pluginId = `${artefact._id}@${artefact.latestMajor}`
  step.value = '2'
}
const isPicked = (artefact: RegistryArtefact) =>
  artefact.latestMajor !== undefined &&
  newProcessing.value.pluginId === `${artefact._id}@${artefact.latestMajor}`

const createProcessing = useAsyncAction(
  async () => {
    const processing = await $fetch('/processings', {
      method: 'POST',
      body: JSON.stringify(newProcessing.value)
    })

    await router.replace({ path: `/processings/${processing._id}` })
    showCreateMenu.value = false
  },
  {
    success: t('createSuccess'),
    error: t('createError')
  }
)

onMounted(() => {
  setBreadcrumbs([{
    text: t('processings'),
    to: '/processings'
  }, {
    text: t('createProcessing')
  }])
})

</script>

<i18n lang="yaml">
  en:
    selectPluginType: Processing type selection
    information: Information
    title: Title
    previous: Previous
    create: Create
    noPermission: You do not have permission to create a processing
    searchPlugin: Search for a plugin
    noPlugins: No processing plugins are available for this account.
    noMatch: No plugin matches your search.
    createSuccess: Processing created!
    createError: Error while creating processing
    processings: Processings
    createProcessing: Create a processing
    otherGroup: Other

  fr:
    selectPluginType: Sélection du type de traitement
    information: Informations
    title: Titre
    previous: Précédent
    create: Créer
    noPermission: Vous n'avez pas les droits pour créer un traitement
    searchPlugin: Rechercher un plugin
    noPlugins: Aucun plugin de traitement n'est disponible pour ce compte.
    noMatch: Aucun plugin ne correspond à votre recherche.
    createSuccess: Traitement créé !
    createError: Erreur lors de la création du traitement
    processings: Traitements
    createProcessing: Créer un traitement
    otherGroup: Autres

</i18n>

<style scoped>
</style>
