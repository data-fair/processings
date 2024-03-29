<template>
  <v-container data-iframe-height>
    <v-row>
      <v-col>
        <v-container>
          <v-list-subheader v-if="displayProcessings.length > 1">
            {{ displayProcessings.length }}/{{ totalProcessings }} traitements affichés
          </v-list-subheader>
          <v-list-subheader v-else>
            {{ displayProcessings.length }}/{{ totalProcessings }} traitement affiché
          </v-list-subheader>
          <v-row
            v-if="loading <= 0"
            class="d-flex align-stretch"
          >
            <v-col
              v-for="processing in displayProcessings"
              :key="processing._id"
              md="4"
              sm="6"
              cols="12"
              class="d-flex"
            >
              <ProcessingCard
                :processing="processing"
                :show-owner="showAll"
                :plugin-custom-name="installedPlugins.find(/** @param {Record<String, any>} p */ p => p.id === processing.plugin)?.customName"
                class="w-100"
              />
            </v-col>
          </v-row>
          <v-row
            v-else
            class="d-flex align-stretch"
          >
            <v-col
              v-for="i in 9"
              :key="i"
              md="4"
              sm="6"
              cols="12"
              class="d-flex"
            >
              <v-skeleton-loader
                :class="$vuetify.theme.current.dark ? 'w-100' : 'w-100 skeleton'"
                height="200"
                type="article"
              />
            </v-col>
          </v-row>
        </v-container>
      </v-col>
      <LayoutNavigationRight v-if="$vuetify.display.lgAndUp">
        <ProcessingsActions
          v-if="canAdmin"
          :admin-mode="user.adminMode"
          :c-plugins-selected="pluginsSelected"
          :c-search="search"
          :c-show-all="showAll"
          :c-statuses-selected="statusesSelected"
          :facets="facets"
          :is-small="false"
          :installed-plugins="installedPlugins"
          :processings="displayProcessings"
        />
      </LayoutNavigationRight>
      <LayoutActionsButton
        v-else-if="canAdmin"
        class="pt-2"
      >
        <template #actions>
          <ProcessingsActions
            :admin-mode="user.adminMode"
            :c-plugins-selected="pluginsSelected"
            :c-search="search"
            :c-show-all="showAll"
            :c-statuses-selected="statusesSelected"
            :facets="facets"
            :is-small="true"
            :installed-plugins="installedPlugins"
            :processings="displayProcessings"
          />
        </template>
      </LayoutActionsButton>
    </v-row>
  </v-container>
</template>

<script setup>
import getReactiveSearchParams from '@data-fair/lib/vue/reactive-search-params-global.js'
import useEventBus from '~/composables/event-bus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '@data-fair/lib/vue/session.js'

const eventBus = useEventBus()
const route = useRoute()
const urlSearchParams = getReactiveSearchParams
const session = useSession()

/**
* @typedef InstalledPlugin
 * @property {string} name
 * @property {string} customName
 * @property {string} description
 * @property {string} version
 * @property {string} distTag
 * @property {string} id
 * @property {any} pluginConfigSchema
 * @property {any} processingConfigSchema
*/

const /** @type {Ref<import('../../../shared/types/processing/index.js').Processing[]>} */ processings = ref([])
const /** @type {Ref<{statuses:any, plugins:any}>} */ facets = ref({ statuses: {}, plugins: {} })
const /** @type {Ref<InstalledPlugin[]>} */ installedPlugins = ref([])
const /** @type {Ref<String[]>} */ pluginsSelected = ref(urlSearchParams.plugin ? urlSearchParams.plugin.split(',') : [])
const /** @type {Ref<String[]>} */ statusesSelected = ref(urlSearchParams.status ? urlSearchParams.status.split(',') : [])
const showAll = ref(urlSearchParams.showAll === 'true')
const loading = ref(0)
const search = ref(urlSearchParams.search || '')
const totalProcessings = ref(0)

const displayProcessings = computed(() => {
  if (!search.value) return processings.value
  return processings.value.filter(
    /** @param {Record<String, any>} processing */ processing =>
      processing.title.toLowerCase().includes(search.value.toLowerCase()))
})

// ---------- Permissions ----------
/** @typedef {import('@data-fair/lib/express/index.js').User} User */
/** @typedef {import('@data-fair/lib/express/index.js').Account} Account */

const sessionState = computed(() => session.state)
const /** @type {ComputedRef<User>} */ user = computed(() => {
  if (!sessionState.value.user) navigateTo('/error?statusCode=401&message=' + encodeURIComponent('Authentification nécessaire'))
  return /** @type {User} */(sessionState.value.user)
})

const /** @type {ComputedRef<Account>} */ owner = computed(() => {
  const owner = /** @type {string} */(route.query.owner)
  if (owner) {
    const parts = owner.split(':')
    return /** @type {Account} */({ type: parts[0], id: parts[1] })
  } else {
    if (!sessionState.value.account) navigateTo('/error?statusCode=401&message=' + encodeURIComponent('Authentification nécessaire'))
    return /** @type {Account} */(sessionState.value.account)
  }
})

const ownerRole = computed(() => {
  if (owner.value.type === 'user') {
    if (owner.value.id === user.value.id) return 'admin'
    else return 'anonymous'
  }
  const userOrg = user.value.organizations.find(/** @param {Record<String, any>} o */ o => o.id === owner.value.id)
  return userOrg ? userOrg.role : 'anonymous'
})

const ownerFilter = computed(() => `${owner.value.type}:${owner.value.id}`)

const canAdmin = computed(() => {
  return ownerRole.value === 'admin' || user.value?.adminMode
})
// --------------------------------

onMounted(async () => {
  await fetchInstalledPlugins()
  await fetchProcessings()
})

eventBus.on('search', (/** @type {String} */ searchString) => {
  search.value = searchString || ''
  urlSearchParams.search = searchString
})

eventBus.on('status', async (/** @type {String[]} */ statuses) => {
  statusesSelected.value = statuses
  urlSearchParams.status = statuses.join(',')
  await fetchProcessings()
})

eventBus.on('plugin', async (/** @type {String[]} */ plugins) => {
  pluginsSelected.value = plugins
  urlSearchParams.plugin = plugins.join(',')
  await fetchProcessings()
})

eventBus.on('showAll', async (/** @type {Boolean} */ show) => {
  showAll.value = show
  urlSearchParams.showAll = show ? 'true' : 'false'
  await fetchProcessings()
})

async function fetchInstalledPlugins() {
  if (!canAdmin.value) return
  /** @type {any} */
  const pluginsResponse = await $fetch(`/api/v1/plugins?privateAccess=${ownerFilter.value}`)
  installedPlugins.value = pluginsResponse.results || []
}

async function fetchProcessings() {
  loading.value += 1
  try {
    /** @type {any} */
    const params = {
      size: '10000',
      showAll: showAll.value,
      sort: 'updated.date:-1',
      select: '_id,title,plugin,lastRun,nextRun,owner'
    }
    if (pluginsSelected.value.length) params.plugins = pluginsSelected.value.join(',')
    if (statusesSelected.value.length) params.statuses = statusesSelected.value.join(',')
    if (!showAll.value) params.owner = ownerFilter.value

    /** @type {{count:number, results:import('../../../shared/types/processing/index.js').Processing[], facets:{statuses:any, plugins:any}}} */
    const processingsResponse = await $fetch('/api/v1/processings', { params })
    processings.value = processingsResponse.results || []
    facets.value = processingsResponse.facets || { statuses: {}, plugins: {} }
    totalProcessings.value = processingsResponse.count || 0
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant la récupération de la liste des traitements' })
    processings.value = []
  } finally {
    loading.value -= 1
  }
}

</script>

<style scoped>
</style>
