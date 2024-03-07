<template>
  <v-container
    data-iframe-height
    style="min-height:500px;"
  >
    <v-row>
      <v-col>
        <v-container>
          <v-list-subheader>{{ (processings && processings.count) || 0 }} traitements</v-list-subheader>
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
      <layout-navigation-right v-if="$vuetify.display.lgAndUp">
        <processings-actions
          v-if="canAdmin"
          :installed-plugins="installedPlugins"
        />
        <v-card
          v-if="user.adminMode"
          flat
          class="mt-2 adminSwitch"
        >
          <v-card-text class="pa-3">
            <v-switch
              v-model="showAll"
              color="admin"
              label="voir tous les traitements"
              hide-details
              density="compact"
              class="mt-0"
              @update:model-value="refresh"
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
import format from '~/assets/format'
import useEventBus from '~/composables/event-bus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from '~/store/index'

const eventBus = useEventBus()
const store = useStore()
const route = useRoute()

const installedPlugins = ref({})
const processings = ref(null)
const showAll = ref(false)

const activeAccount = computed(() => store.activeAccount)
const env = computed(() => store.env)
const user = computed(() => store.user)

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
  store.setBreadcrumbs([{ title: 'traitements', disabled: false }])
  await refresh()
  await fetchInstalledPlugins()
})

async function fetchInstalledPlugins() {
  if (!canAdmin.value) return
  installedPlugins.value = await $fetch(`${env.value.publicUrl}/api/v1/plugins?privateAccess=${ownerFilter.value}`)
}

async function refresh() {
  try {
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
    processings.value = await $fetch(`${env.value.publicUrl}/api/v1/processings`, { params })
  } catch (error) {
    eventBus.emit('notification', { error, msg: 'Erreur pendant la récupération de la liste des traitements' })
  }
}

</script>

<style scoped>
.adminSwitch {
  background-color: rgb(var(--v-theme-background)) !important;
}

:deep(.adminSwitch) {
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
