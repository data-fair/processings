<template>
  <v-menu v-model="menu" width="500" :close-on-click="false" :close-on-content-click="false">
    <template v-slot:activator="{ on }">
      <v-btn
        icon color="warning" text v-on="on"
        @click="open"
      >
        <v-icon>mdi-delete</v-icon>
      </v-btn>
    </template>

    <v-card>
      <v-card-title class="title">
        Suppression d'un élément
      </v-card-title>

      <v-card-text>
        <p>
          Voulez vous vraiment supprimer le traitement <span
            v-if="processing.title"
            class="accent--text"
          >{{ processing.title }}</span> ?
        </p>
        <p>La suppression est définitive.</p>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn text @click.native="menu = false">
          Annuler
        </v-btn>
        <v-btn
          color="warning"
          @click.native="confirm"
        >
          Oui
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script>
import eventBus from '../event-bus'

export default {
  props: {
    processing: { type: Object, default: null }
  },
  data: () => ({
    menu: false
  }),
  methods: {
    open (e) {
      this.menu = true
      e.stopPropagation()
    },
    async confirm () {
      try {
        await this.$axios.$delete(process.env.publicUrl + '/api/v1/processings/' + this.processing.id)
        this.$emit('removed', { id: this.processing.id })
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant la suppression du traitement' })
      } finally {
        this.menu = false
      }
    }
  }
}
</script>
