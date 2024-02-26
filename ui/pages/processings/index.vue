<template>
  <v-container
    data-iframe-height
    style="min-height:500px;"
  >
    <v-row>
      <v-col :style="$vuetify.breakpoint.lgAndUp ? 'padding-right:256px;' : ''">
        <v-container>
          <v-subheader>{{ (processings && processings.count) || 0 }} traitements</v-subheader>
          <v-row v-if="processings">
            <v-col
              v-for="processing in processings.results"
              :key="processing._id"
              md="4"
              sm="6"
              cols="12"
            >
              <processing-card
                :processing="processing"
                :show-owner="showAll"
                :plugin="installedPlugins.results && installedPlugins.results.find(p => p.id === processing.plugin)"
              />
            </v-col>
          </v-row>
        </v-container>
      </v-col>
      <layout-navigation-right v-if="$vuetify.breakpoint.lgAndUp">
        <processings-actions
          v-if="canAdmin"
          :installed-plugins="installedPlugins"
        />
        <v-card
          v-if="user.adminMode"
          color="admin"
          dark
          flat
          class="mt-2"
        >
          <v-card-text class="pa-1">
            <v-switch
              v-model="showAll"
              label="voir tous les traitements"
              hide-details
              dense
              class="mt-0"
              @change="refresh"
            />
          </v-card-text>
        </v-card>
      </layout-navigation-right>
      <layout-actions-button
        v-else-if="canAdmin"
        class="pt-2"
      >
        <template #actions>
          <processings-actions
            :installed-plugins="installedPlugins"
          />
        </template>
      </layout-actions-button>
    </v-row>
  </v-container>
</template>

<script setup>
import useEventBus from '~/composables/event-bus'
import { ref, computed, onMounted } from 'vue'
import { useAxios } from '@vueuse/integrations/useAxios'
import { useRoute } from 'vue-router'
import { useStore } from '~/store/index'

const store = useStore()
const route = useRoute()
const eventBus = useEventBus()

const processings = ref(null)
const installedPlugins = ref({})
const showAll = ref(false)

const env = computed(() => store.env)
const user = computed(() => store.user)
const activeAccount = computed(() => store.activeAccount)

const owner = computed(() => {
  if (route.query.owner) {
    const parts = route.query.owner.split(':')
    return { type: parts[0], id: parts[1] }
  } else {
    return activeAccount.value
  }
})

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
  if (env.value.secondaryHost) return false
  return ownerRole.value === 'admin' || user.value.adminMode
})

onMounted(async () => {
  store.setBreadcrumbs([{ text: 'traitements' }])
  await refresh()
  await fetchInstalledPlugins()
})

async function fetchInstalledPlugins() {
  if (!canAdmin.value) return
  const { data } = await useAxios(`/api/v1/plugins?privateAccess=${ownerFilter.value}`)
  installedPlugins.value = data.value
}

async function refresh() {
  try {
    const params = new URLSearchParams({
      size: '10000',
      showAll: showAll.value ? 'true' : 'false',
      sort: 'updated.date:-1',
      select: '_id,title,plugin,lastRun,nextRun,owner',
      owner: ownerFilter.value
    }).toString()
    const { data } = await useAxios(`api/v1/processings?${params}`)
    processings.value = data.value
  } catch (error) {
    eventBus.$emit('notification', { error, msg: 'Erreur pendant la récupération de la liste des traitements' })
  }
}

</script>
