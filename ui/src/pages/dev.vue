<template>
  <v-app-bar
    flat
    dense
    class="px-0 main-app-bar"
  >
    <v-toolbar-items>
      <v-btn
        variant="text"
        href="/processings/processings"
      >
        Traitements
      </v-btn>
      <v-btn
        variant="text"
        href="/processings/admin/plugins"
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
    <v-spacer />
    <personal-menu />
  </v-app-bar>
</template>

<script setup>
import personalMenu from '@data-fair/lib-vuetify/personal-menu.vue'
</script>

<style>
</style>
