<template lang="html">
  <v-tooltip v-if="processing" top>
    <template v-slot:activator="{ on }">
      <v-btn text v-on="on" @click="dialog=true">
        <v-icon color="primary" small>
          mdi-help
        </v-icon>
      </v-btn>
    </template>
    <span>Déclenchement par webhook</span>
    <v-dialog v-model="dialog" :fullscreen="$vuetify.breakpoint.mdAndDown" :max-width="1000">
      <v-card>
        <v-card-title>
          Vous pouvez déclencher une éxécution du traitement avec l'appel suivant :
        </v-card-title>
        <v-card-text>
          <code style="width:100%">
            {{ curl }}
          </code>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-tooltip>
</template>

<script>
export default {
  props: {
    processing: { type: Object, required: true }
  },
  data() {
    return {
      dialog: null
    }
  },
  computed: {
    curl () {
      return `curl -X POST ${process.env.publicUrl}/api/v1/processings/${this.processing.id}/_run -H 'x-apikey: ${this.processing.webhookKey}'`
    }
  }
}
</script>
