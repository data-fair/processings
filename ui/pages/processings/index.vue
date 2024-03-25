<template>
  <v-container
    data-iframe-height
    style="min-height:500px;"
  >
    <v-row>
      <v-col>
        <v-container>
          <v-list-subheader>{{ displayProcessings.length }} traitements</v-list-subheader>
          <v-row v-if="processings">
            <v-col
              v-for="processing in displayProcessings"
              :key="processing._id"
              md="4"
              sm="6"
              cols="12"
            >
              <ProcessingCard
                :processing="processing"
                :show-owner="showAll"
                :plugin="installedPlugins.results && installedPlugins.results.find(p => p.id === processing.plugin)"
              />
            </v-col>
          </v-row>
        </v-container>
      </v-col>
      <LayoutNavigationRight v-if="$vuetify.display.lgAndUp">
        <ProcessingsActions
          v-if="canAdmin"
          :is-small="false"
          :installed-plugins="installedPlugins"
          :processings="displayProcessings"
        />
        <v-card
          v-if="user.adminMode"
          flat
          class="mt-4 px-6 adminSwitch"
        >
          <v-switch
            v-model="showAll"
            color="admin"
            label="Voir tous les traitements"
            hide-details
            density="compact"
            class="adminSwitch"
            @update:model-value="refresh()"
          />
        </v-card>
      </LayoutNavigationRight>
      <LayoutActionsButton
        v-else-if="canAdmin"
        class="pt-2"
      >
        <template #actions>
          <ProcessingsActions
            :is-small="true"
            :installed-plugins="installedPlugins"
            :processings="displayProcessings"
          />
          <v-card
            v-if="user.adminMode"
            variant="text"
            class="px-6 adminSwitch"
          >
            <v-switch
              v-model="showAll"
              color="admin"
              label="Voir tous les traitements"
              hide-details
              density="compact"
              class="adminSwitch"
              @update:model-value="refresh()"
            />
          </v-card>
        </template>
      </LayoutActionsButton>
    </v-row>
  </v-container>
</template>

<script setup>
import useEventBus from '~/composables/event-bus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '@data-fair/lib/vue/session.js'

const eventBus = useEventBus()
const route = useRoute()
const session = useSession()

const filteredPlugins = ref([])
const filteredStatuses = ref([])
/** @type {any} */
const installedPlugins = ref({})
/** @type {any} */
const processings = ref(null)
const showAll = ref(false)
const searchResults = ref('')
const selectedPlugins = ref([])

const activeAccount = computed(() => session.state.account)
const user = computed(() => session.state.user)

const owner = computed(() => {
  if (route.query.owner) {
    const parts = route.query.owner.split(':')
    return { type: parts[0], id: parts[1] }
  } else {
    return activeAccount.value
  }
})

const statusesText = {
  error: 'En échec',
  finished: 'Terminé',
  kill: 'Interruption',
  killed: 'Interrompu',
  none: 'Aucune exécution',
  running: 'Démarré',
  scheduled: 'Planifié',
  triggered: 'Déclenché'
}

if (!user.value || !owner.value) {
  window.location.href = '/error?statusCode=401&message=' + encodeURIComponent('Authentification nécessaire')
}

const ownerRole = computed(() => {
  if (owner.value.type === 'user') {
    if (owner.value.id === user.value.id) return 'admin'
    else return 'anonymous'
  }
  const userOrg = user.value.organizations.find(o => o.id === owner.value.id)
  return userOrg ? userOrg.role : 'anonymous'
})

const ownerFilter = computed(() => `${owner.value.type}:${owner.value.id}`)

const canAdmin = computed(() => {
  return ownerRole.value === 'admin' || user.value.adminMode
})

const displayProcessings = computed(() => {
  return refreshProcessings()
})

onMounted(async () => {
  await refresh()
  await fetchInstalledPlugins()
  refreshPlugins()
})

eventBus.on('search', (results) => {
  searchResults.value = results || ''
})

eventBus.on('status', (statuses) => {
  filteredStatuses.value = statuses
  refreshProcessings()
})

eventBus.on('plugin', (plugins) => {
  filteredPlugins.value = plugins
  refreshPlugins()
})

function refreshProcessings() {
  let results = processings.value?.results || []
  if (searchResults.value.length > 0) {
    results = results.filter(result => result.title.includes(searchResults.value))
  }
  results = results.filter(processing => {
    return selectedPlugins.value.find(plugin => plugin.id === processing.plugin)
  })
  if (filteredStatuses.value.length === 0) {
    return results
  }

  const temp = []
  results.forEach(result => {
    const status = result.lastRun ? result.lastRun.status : 'none'
    if (result.nextRun) {
      temp.push({ _id: result._id, status, nextRun: result.nextRun })
    } else {
      temp.push({ _id: result._id, status })
    }
  })

  const finalArray = []
  temp.forEach(tempItem => {
    const statusText = statusesText[tempItem.status]
    const filteredStatusesMainText = filteredStatuses.value.map(status => status.split(' (')[0])
    if (filteredStatusesMainText.includes(statusText)) {
      const originalItem = results.find(item => item._id === tempItem._id)
      if (originalItem) {
        finalArray.push(originalItem)
      }
    }
    const filteredStatusesNextText = filteredStatuses.value.map(status => status.split(' (')[0])
    if (tempItem.nextRun && filteredStatusesNextText.includes('Planifié')) {
      const originalItem = results.find(item => item._id === tempItem._id)
      if (originalItem) {
        finalArray.push(originalItem)
      }
    }
  })

  return finalArray
}

function refreshPlugins() {
  if (!installedPlugins.value) return
  const results = installedPlugins.value.results || []
  if (selectedPlugins.value.length === 0 || filteredPlugins.value.length === 0) {
    selectedPlugins.value = results
  } else {
    selectedPlugins.value = results.filter(plugin => {
      const customName = plugin.customName.split(' (')[0]
      return filteredPlugins.value.includes(customName)
    })
  }
}

async function fetchInstalledPlugins() {
  if (!canAdmin.value) return // TODO Why ?
  installedPlugins.value = await $fetch(`/api/v1/plugins?privateAccess=${ownerFilter.value}`)
}

async function refresh() {
  try {
    /** @type {any} */
    const params = {
      size: '10000',
      showAll: showAll.value,
      sort: 'updated.date:-1',
      select: '_id,title,plugin,lastRun,nextRun,owner'
    }
    if (showAll.value) {
      params.showAll = true
    } else {
      params.owner = ownerFilter.value
    }
    processings.value = await $fetch('/api/v1/processings', { params })
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant la récupération de la liste des traitements' })
  }
}

</script>

<style scoped>
/* This aims at making the button looking better.
 * Instead of having a white string on a red background, we have a red string on the actual page's background
 * Plus the button is also red, and the text is bold so it's easier to read
 */
:deep(.adminSwitch) {
  background-color: transparent !important;
  color: rgb(var(--v-theme-admin)) !important;
}

:deep(.adminSwitch .v-switch__thumb) {
  background-color: rgb(var(--v-theme-admin)) !important;
}

:deep(.adminSwitch .v-switch__track) {
  background-color: rgb(var(--v-theme-admin)) !important;
  filter: saturate(100%);
}

:deep(.adminSwitch .v-switch__track:not(.bg-admin)) {
  filter: saturate(50%);
}

:deep(.adminSwitch label) {
  color: rgb(var(--v-theme-admin)) !important;
  font-weight: bold !important;
  padding-inline-start: 30px !important;
}
</style>
