<template>
  <v-container
    data-iframe-height
  >
    <fetch-error
      v-if="installedPluginsFetch.error.value"
      :error="installedPluginsFetch.error.value"
    />
    <v-row v-else-if="!installedPluginsFetch.pending.value">
      <v-col>
        <v-container>
          <v-row
            v-if="processingsFetch.pending.value"
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
          <fetch-error
            v-else-if="processingsFetch.error.value"
            :error="processingsFetch.error.value"
          />
          <template v-else>
            <v-list-subheader v-if="displayProcessings.length > 1">
              {{ displayProcessings.length }}/{{ processingsFetch.data.value.count }} traitements affichés
            </v-list-subheader>
            <v-list-subheader v-else>
              {{ displayProcessings.length }}/{{ processingsFetch.data.value.count }} traitement affiché
            </v-list-subheader>
            <v-row
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
                  :plugin-custom-name="installedPluginsFetch.data.value.results.find(p => p.id === processing.plugin)?.customName"
                  class="w-100"
                />
              </v-col>
            </v-row>
          </template>
        </v-container>
      </v-col>
      <template v-if="processingsFetch.data.value">
        <LayoutNavigationRight v-if="$vuetify.display.lgAndUp">
          <ProcessingsActions
            v-if="canAdmin"
            v-model:search="search"
            v-model:show-all="showAll"
            v-model:plugins-selected="plugins"
            v-model:statuses-selected="status"
            :admin-mode="session.state.user?.adminMode"
            :facets="processingsFetch.data.value.facets"
            :is-small="false"
            :installed-plugins="installedPluginsFetch.data.value.results"
            :processings="displayProcessings"
          />
        </LayoutNavigationRight>
        <LayoutActionsButton
          v-else-if="canAdmin"
          class="pt-2"
        >
          <template #actions>
            <ProcessingsActions
              v-model:search="search"
              v-model:show-all="showAll"
              v-model:plugins-selected="plugins"
              v-model:statuses-selected="status"
              :admin-mode="session.state.user?.adminMode"
              :facets="processingsFetch.data.value.facets"
              :is-small="true"
              :installed-plugins="installedPluginsFetch.data.value.results"
              :processings="displayProcessings"
            />
          </template>
        </LayoutActionsButton>
      </template>
    </v-row>
  </v-container>
</template>

<script setup>
import setBreadcrumbs from '~/utils/breadcrumbs'
import { useStringSearchParam, useBooleanSearchParam, useStringsArraySearchParam } from '@data-fair/lib/vue/reactive-search-params.js'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionAuthenticated } from '@data-fair/lib/vue/session.js'
console.log('111')

const route = useRoute()
const session = useSessionAuthenticated(() => createError({ status: 401, message: 'Authentification nécessaire', fatal: true }))
const showAll = useBooleanSearchParam('showAll')
const search = useStringSearchParam('q')
const plugins = useStringsArraySearchParam('plugin')
const status = useStringsArraySearchParam('status')

onMounted(async () => setBreadcrumbs([{ text: 'traitements' }]))

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

/*
Permissions
*/

/** @typedef {import('@data-fair/lib/express/index.js').User} User */

const owner = computed(() => {
  const owner = /** @type {string} */(route.query.owner)
  if (owner) {
    const parts = owner.split(':')
    return /** @type {import('@data-fair/lib/express/index.js').Account} */({ type: parts[0], id: parts[1] })
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
  const userOrg = user.organizations.find(/** @param {Record<string, any>} o */ o => o.id === owner.value.id)
  return userOrg ? userOrg.role : 'anonymous'
})
const ownerFilter = computed(() => `${owner.value.type}:${owner.value.id}`)
const canAdmin = computed(() => {
  return ownerRole.value === 'admin' || !!session.state.user?.adminMode
})

/*
fetch and filter resources
*/

/** @type {Awaited<ReturnType<typeof useFetch<{count: number, results: InstalledPlugin[]}>>>}  */
const installedPluginsFetch = await useFetch(`/api/v1/plugins?privateAccess=${ownerFilter.value}`, { lazy: true })

const processingsParams = computed(() => {
  /** @type {any} */
  const params = {
    size: '10000',
    showAll: showAll.value,
    sort: 'updated.date:-1',
    select: '_id,title,plugin,lastRun,nextRun,owner'
  }
  if (plugins.value.length) params.plugins = plugins.value.join(',')
  if (status.value.length) params.statuses = status.value.join(',')
  if (!showAll.value) params.owner = ownerFilter.value
  return params
})

/** @type {Awaited<ReturnType<typeof useFetch<{count: number, results: import('../../../shared/types/processing/index.js').Processing[], facets: {statuses: Record<string, number>, plugins: Record<string, number>}}>>>}  */
const processingsFetch = await useFetch('/api/v1/processings', { params: processingsParams, lazy: true })
const displayProcessings = computed(() => {
  const processings = (processingsFetch.data.value?.results ?? [])
  if (!search.value) return processings
  return processings.filter(processing => processing.title.toLowerCase().includes(search.value.toLowerCase()))
})

</script>

<style scoped>
</style>
