<template>
  <v-navigation-drawer
    model-value="true"
    style="padding-top: 20px;"
  >
    <v-list>
      <v-list-item
        :to="{ name: 'index' }"
        exact
      >
        <v-list-item-action>
          <v-icon>mdi-home</v-icon>
        </v-list-item-action>
        <v-list-item-title>Traitements périodiques</v-list-item-title>
      </v-list-item>

      <template v-if="!embed">
        <v-list-item
          v-if="!user"
          color="primary"
          @click="setAdminMode"
        >
          <v-list-item-title>Connexion</v-list-item-title>
        </v-list-item>
        <v-list-item
          v-else
          @click="logout"
        >
          <v-list-item-title>Se déconnecter</v-list-item-title>
        </v-list-item>
        <v-list-item v-if="user">
          <v-menu location="left">
            <template #activator="{ props }">
              <v-select
                v-bind="props"
                :items="[{ text: 'Compte personnel', value: null }].concat(user.organizations.map(o => ({ text: o.name, value: o.id })))"
                label="Compte actif"
                :model-value="activeAccount && activeAccount.type === 'organization' ? activeAccount.id : null"
                @update:model-value="val => switchOrganization(val)"
              />
            </template>
          </v-menu>
        </v-list-item>
      </template>
      <template v-if="!embed && user">
        <v-list-subheader>Vues embarquées</v-list-subheader>
        <v-list-item :to="{ name: 'embed-processings' }">
          <v-list-item-action>
            <v-icon>mdi-face-agent</v-icon>
          </v-list-item-action>
          <v-list-item-title>Mes traitements</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '~/store/index'

const store = useStore()

const user = computed(() => store.user)
const embed = computed(() => store.embed)
const activeAccount = computed(() => store.activeAccount)

const switchOrganization = (val) => {
  store.switchOrganization(val)
}

const logout = () => {
  store.logout()
}

const setAdminMode = () => {
  store.setAdminMode()
}
</script>

<style>
.v-navigation-drawer {
  z-index: 0 !important;
}
</style>
