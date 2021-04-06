<template>
  <v-app>
    <client-only><app-bar v-if="!embed" /></client-only>
    <v-main>
      <nuxt-child />
      <notifications />
    </v-main>
  </v-app>
</template>

<script>
  import 'iframe-resizer/js/iframeResizer.contentWindow'
  import { mapGetters } from 'vuex'
  import Notifications from '../components/notifications.vue'
  import AppBar from '~/components/layout/app-bar.vue'
  export default {
    components: { AppBar, Notifications },
    computed: {
      ...mapGetters(['embed']),
    },
  }

</script>

<style>
/* body .v-application {
  font-family: 'Nunito', sans-serif;
} */
</style>
