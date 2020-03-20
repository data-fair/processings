<template>
  <v-dialog
    v-model="dialog"
    width="500"
  >
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
        <v-btn text @click.native="dialog = false">
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
  </v-dialog>
</template>

<script>
import eventBus from '../event-bus'

export default {
  props: {
    processing: { type: Object, default: null }
  },
  data: () => ({
    dialog: false
  }),
  methods: {
    open (e) {
      this.dialog = true
      e.stopPropagation()
    },
    async confirm () {
      try {
        await this.$axios.$delete(process.env.publicUrl + '/api/v1/processings/' + this.processing.id)
        this.$emit('removed', { id: this.processing.id })
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant la suppression du traitement' })
      } finally {
        this.dialog = false
      }
    }
  }
}
</script>
