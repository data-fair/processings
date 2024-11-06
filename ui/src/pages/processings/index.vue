<template>
  <v-container
    data-iframe-height
    style="min-height:500px"
  >
    <v-row>
      <v-col>
        <v-container>
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
          <template v-else>
            <v-list-subheader v-if="displayProcessings.length > 1">
              {{ displayProcessings.length }}/{{ processingsFetch.data.value?.count }} traitements affichés
            </v-list-subheader>
            <v-list-subheader v-else>
              {{ displayProcessings.length }}/{{ processingsFetch.data.value?.count }} traitement affiché
            </v-list-subheader>
            <v-row class="d-flex align-stretch">
              <v-col
                v-for="processing in displayProcessings"
                :key="processing._id"
                md="4"
                sm="6"
                cols="12"
                class="d-flex"
              >
                <processing-card
                  :processing="processing"
                  :show-owner="showAll || (processing.owner.department && !session.state.account.department)"
                  class="w-100"
                />
              </v-col>
            </v-row>
          </template>
        </v-container>
      </v-col>
      <template v-if="processingsFetch.data.value && canAdmin">
        <layout-navigation-right v-if="$vuetify.display.lgAndUp">
          <processings-actions
            v-model:search="search"
            v-model:show-all="showAll"
            v-model:plugins-selected="plugins"
            v-model:statuses-selected="status"
            :owner-filter="ownerFilter"
            :admin-mode="session.state.user?.adminMode"
            :facets="processingsFetch.data.value.facets"
            :is-small="false"
            :processings="displayProcessings"
          />
        </layout-navigation-right>
        <layout-actions-button
          v-else
          class="pt-2"
        >
          <template #actions>
            <processings-actions
              v-model:search="search"
              v-model:show-all="showAll"
              v-model:plugins-selected="plugins"
              v-model:statuses-selected="status"
              :owner-filter="ownerFilter"
              :admin-mode="session.state.user?.adminMode"
              :facets="processingsFetch.data.value.facets"
              :is-small="true"
              :processings="displayProcessings"
            />
          </template>
        </layout-actions-button>
      </template>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { Processing } from '#api/types'
import setBreadcrumbs from '~/utils/breadcrumbs'

const route = useRoute()
const session = useSessionAuthenticated(() => new Error('Authentification nécessaire'))
const showAll = useBooleanSearchParam('showAll')
const search = useStringSearchParam('q')
const plugins = useStringsArraySearchParam('plugin')
const status = useStringsArraySearchParam('status')

onMounted(async () => setBreadcrumbs([{ text: 'traitements' }]))

/*
  Permissions
*/

const owner = computed(() => {
  const owner = route.query.owner as string | null
  if (owner) {
    const parts = owner.split(':')
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
const canAdmin = computed(() => {
  return ownerRole.value === 'admin' || !!session.state.user?.adminMode
})

/*
  fetch and filter resources
*/

const processingsParams = computed(() => {
  const params: Record<string, any> = {
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

const processingsFetch = useFetch<{
  results: Processing[],
  facets: { usages: Record <string, number > },
  count: number
}>(`${$apiPath}/processings`, { query: processingsParams })

const displayProcessings = computed(() => {
  const processings = (processingsFetch.data.value?.results ?? [])
  if (!search.value) return processings
  return processings.filter(processing => processing.title.toLowerCase().includes(search.value.toLowerCase()))
})

</script>

<style scoped>
</style>
