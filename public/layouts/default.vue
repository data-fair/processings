<template>
  <v-app>
    <v-app-bar app scroll-off-screen>
      <v-toolbar-title class="ml-3">
        <h1 class="headline">
          Collecte de données périodique
        </h1>
      </v-toolbar-title>

      <v-spacer />

      <!-- larger screens: navigation in toolbar -->
      <v-toolbar-items>
        <!-- <v-btn to="/" text color="primary" exact>
          Accueil
        </v-btn> -->

        <!-- Account specific menu -->
        <template v-if="session.initialized">
          <v-btn v-if="!user" color="primary" @click="setAdminMode">
            Se connecter / S'inscrire
          </v-btn>
          <v-menu v-else offset-y left>
            <template v-slot:activator="{on}">
              <v-btn text v-on="on">
                {{ user.name }}
              </v-btn>
            </template>
            <v-list>
              <v-list-item @click="logout">
                <v-list-item-title>Se déconnecter</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </v-toolbar-items>
    </v-app-bar>
    <v-content>
      <nuxt />

      <v-snackbar v-if="notification" ref="notificationSnackbar" v-model="showSnackbar" :color="notification.type" :timeout="notification.type === 'error' ? 0 : 6000" class="notification" bottom>
        <div style="max-width: 85%;">
          <p>{{ notification.msg }}</p>
          <p v-if="notification.errorMsg" class="ml-3">
            {{ notification.errorMsg }}
          </p>
        </div>
        <v-btn text icon @click.native="showSnackbar = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-snackbar>
    </v-content>
    <v-footer class="pa-3">
      <v-spacer />
      <div>Powered by <a href="https://koumoul.com">Koumoul</a></div>
    </v-footer>
  </v-app>
</template>

<script>
import eventBus from '../event-bus'
const { mapActions } = require('vuex')

export default {
  data() {
    return {
      notification: null,
      showSnackbar: false
    }
  },
  computed: {
    session() {
      return this.$store.state.session
    },
    user() {
      return this.session.user
    },
    routePrefix() {
      return this.$route && this.$route.name && this.$route.name.split('-')[0]
    }
  },
  mounted() {
    eventBus.$on('notification', async notif => {
      this.showSnackbar = false
      await this.$nextTick()
      if (typeof notif === 'string') notif = { msg: notif }
      if (notif.error) {
        notif.type = 'error'
        notif.errorMsg = (notif.error.response && (notif.error.response.data || notif.error.response.status)) || notif.error.message || notif.error
      }
      this.notification = notif
      this.showSnackbar = true
    })
  },
  methods: mapActions('session', ['logout', 'setAdminMode'])
}

</script>

<style>
body .application {
  font-family: 'Nunito', sans-serif;
}
body .application .logo-container {
  height: 100%;
  padding: 4px;
  margin-left: 4px !important;
  margin-right: 4px;
}
body .application .logo-container img {
  height: 100%;
}
body .application .main-toolbar {
  background-color: white;
}
body .application .main-toolbar .v-toolbar__content {
  padding-left: 0;
}
body .application .actions-buttons {
  position: absolute;
  top: 76px;
  right: 8px;
  margin: 0;
}
body .application .actions-buttons .v-btn {
  margin-bottom: 16px;
}
body .application .notification .v-snack__content {
  height: auto;
}
body .application .notification .v-snack__content p {
  margin-bottom: 4px;
  margin-top: 4px;
}
.event-finalize-end * {
  color: green !important;
}
.event-publication * {
  color: green !important;
}
.event-error * {
  color: red !important;
}
.event-error .v-list__tile {
  height: auto;
}
.event-error p {
  margin-bottom: 0;
}
iframe {
  background-color: transparent;
  border: none;
}

</style>
