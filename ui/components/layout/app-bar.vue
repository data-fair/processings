<template>
  <v-app-bar app flat dense class="px-0 main-app-bar">
    <v-toolbar-items>
      <v-btn text :to="{ name: 'processings' }">Traitements</v-btn>
      <v-btn text :to="{ name: 'admin-plugins' }" color="admin">Plugins</v-btn>
    </v-toolbar-items>
    <v-breadcrumbs v-if="breadcrumbs" :items="breadcrumbs" />
    <v-spacer />
    <LangSwitcher />
    <PersonalMenu />
  </v-app-bar>
</template>

<script setup>
import LangSwitcher from '@data-fair/sd-vue/src/vuetify/pinia/lang-switcher.vue'
import PersonalMenu from '@data-fair/sd-vue/src/vuetify/pinia/personal-menu.vue'
import { computed } from 'vue'
import { useStore } from '~/store/index'

const store = useStore()

const breadcrumbs = computed(() => store.breadcrumbs)
const user = computed(() => store.user)
const initialized = computed(() => store.initialized)
const activeAccount = computed(() => store.activeAccount)

const { logout, login, setAdminMode, switchOrganization } = store

const reload = () => {
  window.location.reload()
}
</script>

<style lang="css">
.main-app-bar .v-toolbar__content {
  padding-left: 0;
  padding-right: 0;
}
</style>
