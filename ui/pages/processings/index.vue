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
          class="mt-2 pa-3 adminSwitch"
        >
          <v-switch
            v-model="showAll"
            color="admin"
            label="Voir tous les traitements"
            hide-details
            density="compact"
            class="mt-0 adminSwitch"
            @update:model-value="refresh"
          />
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
          <v-card
            v-if="user.adminMode"
            variant="text"
            class="mt-0 pa-3 adminSwitch"
          >
            <v-switch
              v-model="showAll"
              color="admin"
              label="Voir tous les traitements"
              hide-details
              density="compact"
              class="mt-0 adminSwitch"
              @update:model-value="refresh"
            />
          </v-card>
        </template>
      </layout-actions-button>
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

/** @type {any} */
const installedPlugins = ref({})
/** @type {any} */
const processings = ref(null)
const showAll = ref(false)

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

onMounted(async () => {
  await refresh()
  await fetchInstalledPlugins()
})

async function fetchInstalledPlugins() {
  if (!canAdmin.value) return
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
