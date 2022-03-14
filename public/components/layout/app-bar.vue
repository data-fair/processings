<template>
  <v-app-bar
    app
    flat
    dense
    class="px-0 main-app-bar"
  >
    <v-toolbar-items>
      <v-btn
        text
        :to="{name: 'processings'}"
      >
        Traitements
      </v-btn>
      <v-btn
        text
        :to="{name: 'admin-plugins'}"
        color="admin"
      >
        Plugins
      </v-btn>
    </v-toolbar-items>
    <v-breadcrumbs
      v-if="breadcrumbs"
      :items="breadcrumbs"
    />
    <v-spacer />
    <v-toolbar-items>
      <template v-if="initialized">
        <v-btn
          v-if="!user"
          depressed
          color="primary"
          @click="login"
        >
          Se connecter / S'inscrire
        </v-btn>
        <v-menu
          v-else
          offset-y
          nudge-left
          max-height="500"
        >
          <template #activator="{on}">
            <v-btn
              text
              class="px-0"
              v-on="on"
            >
              <v-avatar :size="36">
                <img :src="`${directoryUrl}/api/avatars/${activeAccount.type}/${activeAccount.id}/avatar.png`">
              </v-avatar>
            </v-btn>
          </template>

          <v-list outlined>
            <v-list-item disabled>
              <v-list-item-avatar class="ml-0 my-0">
                <v-avatar :size="28">
                  <img :src="activeAccount.type === 'user' ? `${directoryUrl}/api/avatars/user/${user.id}/avatar.png` : `${directoryUrl}/api/avatars/organization/${activeAccount.id}/avatar.png`">
                </v-avatar>
              </v-list-item-avatar>
              <v-list-item-title>{{ activeAccount.type === 'user' ? 'Compte personnel' : activeAccount.name }}</v-list-item-title>
            </v-list-item>

            <template v-if="user.organizations.length">
              <v-subheader>Changer de compte</v-subheader>
              <v-list-item
                v-if="activeAccount.type !== 'user'"
                id="toolbar-menu-switch-user"
                @click="switchOrganization(); reload()"
              >
                <v-list-item-avatar class="ml-0 my-0">
                  <v-avatar :size="28">
                    <img :src="`${directoryUrl}/api/avatars/user/${user.id}/avatar.png`">
                  </v-avatar>
                </v-list-item-avatar>
                <v-list-item-title>Compte personnel</v-list-item-title>
              </v-list-item>
              <v-list-item
                v-for="organization in user.organizations.filter(o => activeAccount.type === 'user' || activeAccount.id !== o.id)"
                :id="'toolbar-menu-switch-orga-' + organization.id"
                :key="organization.id"
                @click="switchOrganization(organization.id); reload()"
              >
                <v-list-item-avatar class="ml-0 my-0">
                  <v-avatar :size="28">
                    <img :src="`${directoryUrl}/api/avatars/organization/${organization.id}/avatar.png`">
                  </v-avatar>
                </v-list-item-avatar>
                <v-list-item-title>{{ organization.name }}</v-list-item-title>
              </v-list-item>
              <v-divider />
            </template>
            <v-divider />

            <!-- toggle admin mode -->
            <template v-if="user.isAdmin">
              <v-list-item dense>
                <v-list-item-action><v-icon>mdi-shield-alert</v-icon></v-list-item-action>
                <v-list-item-title style="overflow: visible;">
                  <v-switch
                    v-model="user.adminMode"
                    color="admin"
                    hide-details
                    class="mt-0"
                    label="mode admin"
                    @change="setAdminMode"
                  />
                </v-list-item-title>
              </v-list-item>
            </template>

            <v-list-item @click="logout">
              <v-list-item-action><v-icon>mdi-logout</v-icon></v-list-item-action>
              <v-list-item-title>Se déconnecter</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-toolbar-items>
  </v-app-bar>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'

export default {
  computed: {
    ...mapState(['breadcrumbs']),
    ...mapState('session', ['user', 'initialized']),
    ...mapGetters('session', ['activeAccount']),
    directoryUrl () {
      return process.env.directoryUrl
    }
  },
  methods: {
    ...mapActions('session', ['logout', 'login', 'setAdminMode', 'switchOrganization']),
    reload () {
      window.location.reload()
    }
  }
}
</script>

<style lang="css">
.main-app-bar .v-toolbar__content {
  padding-left: 0;
  padding-right: 0;
}
</style>
