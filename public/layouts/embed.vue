<template>
  <v-app class="embed">
    <v-content>
      <nuxt />
      <notifications />
    </v-content>
  </v-app>
</template>

<script>
import Notifications from '~/components/notifications.vue'
import 'iframe-resizer/js/iframeResizer.contentWindow'

export default {
  components: {
    Notifications
  }
}

</script>

<style>
body .v-application {
  font-family: 'Nunito', sans-serif;
}
body .v-application.embed {
  background: transparent;
}
html {
  overflow-y: auto !important;
}
</style>
