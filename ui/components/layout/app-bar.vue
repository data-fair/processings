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
      <v-btn
        variant="text"
        target="_blank"
        href="/simple-directory"
        color="primary"
      >
        Simple Directory
      </v-btn>
      <v-btn
        variant="text"
        target="_blank"
        href="/data-fair"
        color="primary"
      >
        Data Fair
      </v-btn>
    </v-toolbar-items>
  </v-app-bar>
</template>

<script setup>
</script>

<style scoped lang="scss">
.main-app-bar .v-toolbar__content {
  padding-left: 0;
  padding-right: 0;
}
</style>
