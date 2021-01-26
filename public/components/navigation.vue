<template>
  <v-navigation-drawer stateless fixed value="true" style="padding-top: 20px;">
    <v-list>
      <v-list-item :to="{name: 'index'}" exact>
        <v-list-item-action>
          <v-icon>mdi-home</v-icon>
        </v-list-item-action>
        <v-list-item-title>Traitements périodiques</v-list-item-title>
      </v-list-item>

      <template v-if="!embed">
        <v-list-item v-if="!user" color="primary" @click="setAdminMode">
          <v-list-item-title>
            Connexion
          </v-list-item-title>
        </v-list-item>
        <v-list-item v-else @click="logout">
          <v-list-item>
            <v-list-item-title>
              Se déconnecter
            </v-list-item-title>
          </v-list-item>
        </v-list-item>
        <v-list-item v-if="user">
          <v-menu offset-y left>
            <template v-slot:activator="{on}">
              <v-select
                :items="[{text: 'Compte personnel', value: null}].concat(user.organizations.map(o => ({text: o.name, value: o.id})))"
                label="Compte actif"
                :value="activeAccount && activeAccount.type === 'organization' ? activeAccount.id : null"
                @change="val => switchOrganization(val)"
              />
            </template>
          </v-menu>
        </v-list-item>
      </template>
      <template v-if="!embed && user">
        <v-subheader>Vues embarquées</v-subheader>
        <v-list-item :to="{name: `embed-processings`}">
          <v-list-item-action>
            <v-icon>mdi-face-agent</v-icon>
          </v-list-item-action>
          <v-list-item-title>Mes traitements</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
  </v-navigation-drawer>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'
export default {
  computed: {
    ...mapState('session', ['user']),
    ...mapState(['embed']),
    ...mapGetters('session', ['activeAccount'])
  },
  methods: {
    ...mapActions('session', ['switchOrganization', 'logout', 'setAdminMode'])
  }
}

</script>

<style>
.v-navigation-drawer{
    z-index:0!important;
}
</style>
