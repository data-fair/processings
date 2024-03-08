<template>
  <v-app-bar
    flat
    dense
    class="px-0 main-app-bar"
  >
    <v-toolbar-items>
      <v-btn
        variant="text"
        :to="{ name: 'processings' }"
      >
        Traitements
      </v-btn>
      <v-btn
        variant="text"
        :to="{ name: 'admin-plugins' }"
        color="admin"
      >
        Plugins
      </v-btn>
    </v-toolbar-items>
    <v-breadcrumbs
      v-if="breadcrumbs"
      :items="breadcrumbs"
      density="comfortable"
    />
    <v-spacer />
    <LangSwitcher />
    <PersonalMenu />
  </v-app-bar>
</template>

<script setup>
import LangSwitcher from '~/components/layout/sd/lang-switcher.vue'
import PersonalMenu from '~/components/layout/sd/personal-menu.vue'
import { computed, getCurrentInstance, watch } from 'vue'
import { useStore } from '~/store/index'

const instance = getCurrentInstance()
const store = useStore()

const breadcrumbs = computed(() => store.breadcrumbs)

// breadcrumbs is a computed value so it should auto update when the store.breadcrumbs changes
// However it doesn't work as the full window isn't reloaded and we're only transitioning between pages
// So we force a component update
watch(breadcrumbs, () => {
  instance?.proxy?.$forceUpdate()
})
</script>

<style scoped lang="scss">
.main-app-bar .v-toolbar__content {
  padding-left: 0;
  padding-right: 0;
}

// Changes the color of clickable links
:deep(.v-breadcrumbs-item--link) {
  color: rgb(var(--v-theme-primary));
}

// Makes the divider less visible
:deep(.v-breadcrumbs-divider) {
  color: rgba(var(--v-theme-on-background), 0.5);
}
</style>
