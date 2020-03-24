<template>
  <v-app>
    <v-content>
      <v-layout>
        <navigation />
        <v-container fluid style="padding-left:330px;" class="padded">
          <nuxt />
        </v-container>
      </v-layout>
      <notifications />
    </v-content>
  </v-app>
</template>

<script>
import { mapState } from 'vuex'
import Notifications from '../components/notifications.vue'
import Navigation from '../components/navigation.vue'

export default {
  components: {
    Notifications,
    Navigation
  },
  computed: {
    ...mapState('session', ['user'])
  },
  watch: {
    user(newV, oldV) {
      if (oldV && !newV) {
        this.$router.go()
      }
    }
  },
  mounted() {
    this.$store.commit('setAny', { embed: this.$route.query.embed === 'true' })
  }
}

</script>

<style>
.v-navigation-drawer{
    z-index:0!important;
}

body .v-application {
  font-family: 'Nunito', sans-serif;
}
</style>
