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
    <lang-switcher />
    <personal-menu />
  </v-app-bar>
</template>

<script>
import PersonalMenu from '@data-fair/sd-vue/src/vuetify/personal-menu.vue'
import LangSwitcher from '@data-fair/sd-vue/src/vuetify/lang-switcher.vue'
import { mapState, mapGetters, mapActions } from 'vuex'

export default {
  components: { PersonalMenu, LangSwitcher },
  computed: {
    ...mapState(['breadcrumbs']),
    ...mapState('session', ['user', 'initialized']),
    ...mapGetters('session', ['activeAccount'])
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
