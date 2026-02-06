<template>
  <v-container
    data-iframe-height
    style="min-height:500px"
  >
    <!-- Skeleton loader-->
    <v-row
      v-if="processingsFetch.loading.value"
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
    <!-- No processings created -->
    <span
      v-else-if="!processingsFetch.data.value?.results.length"
      class="d-flex justify-center text-h6 mt-4"
    >
      {{ t('noProcessingsCreated') }}
    </span>
    <!-- No processings displayed (filters) -->
    <span
      v-else-if="!displayProcessings.length"
      class="d-flex justify-center text-h6 mt-4"
    >
      {{ t('noProcessingsDisplayed') }}
    </span>
    <!-- List of catalogs -->
    <template v-else>
      <v-row class="d-flex align-stretch">
        <v-col
          v-for="processing in displayProcessings"
          :key="processing._id"
          md="4"
          sm="6"
          cols="12"
        >
          <processing-card
            :processing="processing"
            :show-owner="!!(showAll || (processing.owner.department && !session.state.account.department))"
          />
        </v-col>
      </v-row>
    </template>

    <navigation-right v-if="processingsFetch.data.value">
      <processings-actions
        v-model:search="search"
        v-model:show-all="showAll"
        v-model:plugins-selected="plugins"
        v-model:statuses-selected="statuses"
        v-model:owners-selected="owners"
        :admin-mode="!!session.state.user?.adminMode"
        :can-admin="canAdmin"
        :facets="processingsFetch.data.value.facets"
        :is-small="true"
        :owner-filter="ownerFilter"
        :processings="displayProcessings"
      />
    </navigation-right>
  </v-container>
</template>

<script setup lang="ts">
import type { Processing } from '#api/types'
import NavigationRight from '@data-fair/lib-vuetify/navigation-right.vue'

const { t } = useI18n()
const session = useSessionAuthenticated(() => new Error('Authentification nécessaire'))
const showAll = useBooleanSearchParam('showAll')
const search = useStringSearchParam('q')
const plugins = useStringsArraySearchParam('plugin')
const statuses = useStringsArraySearchParam('status')
const owners = useStringsArraySearchParam('owner')

/*
  Permissions
*/
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
const ownerFilter = computed(() => `${owner.value.type}:${owner.value.id}${owner.value.department ? ':' + owner.value.department : ''}`)
const canAdmin = computed(() => ownerRole.value === 'admin' || !!session.state.user?.adminMode)

/*
  fetch and filter resources
*/

const processingsParams = computed(() => {
  const params: Record<string, any> = {
    size: '10000',
    showAll: showAll.value,
    sort: 'updated.date:-1',
    select: '_id,title,plugin,lastRun,nextRun,owner,active,config'
  }
  if (plugins.value.length) params.plugins = plugins.value.join(',')
  if (statuses.value.length) params.statuses = statuses.value.join(',')
  if (owners.value) {
    params.owner = owners.value.join(',')
  } else {
    params.owner = ownerFilter.value
  }
  return params
})

const processingsFetch = useFetch<{
  results: Processing[],
  facets: { statuses: Record<string, number>, plugins: Record<string, number>, owners: { id: string, name: string, totalCount: number, type: string, departments: { department: string, departmentName: string, count: number }[] }[] },
  count: number
}>(`${$apiPath}/processings`, { query: processingsParams })

const displayProcessings = computed(() => {
  const processings = (processingsFetch.data.value?.results ?? [])
  if (!search.value) return processings
  return processings.filter(processing => processing.title.toLowerCase().includes(search.value.toLowerCase()))
})

watch(
  [() => processingsFetch.data.value?.count, () => displayProcessings.value.length],
  ([count, displayed]) => {
    setBreadcrumbs([{ text: t('processingDisplayed', { count: count ?? 0, displayed }) }])
  },
  { immediate: true }
)

</script>

<i18n lang="yaml">
  en:
    processingDisplayed: No processings | {displayed}/{count} processing displayed | {displayed}/{count} processings displayed
    noProcessingsCreated: You haven't created any processings yet.
    noProcessingsDisplayed: No results match the search criteria.

  fr:
    processingDisplayed: Aucun traitement | {displayed}/{count} traitement affiché | {displayed}/{count} traitements affichés
    noProcessingsCreated: Vous n'avez pas encore créé de traitement.
    noProcessingsDisplayed: Aucun résultat ne correspond aux critères de recherche.

</i18n>

<style scoped>
</style>
