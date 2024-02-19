<template>
  <v-list
    dense
    class="list-actions"
  >
    <v-menu
      v-if="canAdmin || canExec"
      v-model="showTriggerMenu"
      :close-on-content-click="false"
      max-width="800"
    >
      <template #activator="{on, attrs}">
        <v-list-item
          v-bind="attrs"
          :disabled="!processing.active"
          v-on="on"
        >
          <v-list-item-icon>
            <v-icon color="primary">
              mdi-play
            </v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>Exécuter</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </template>
      <v-card outlined>
        <v-card-title primary-title>
          Exécution du traitement
        </v-card-title>
        <v-card-text>
          <p v-if="canAdmin">
            Vous pouvez déclencher une exécution sans être connecté à la plateforme en envoyant une requête HTTP POST à cette URL sécurisée :
            <br>{{ webhookLink }}
          </p>
          <v-text-field
            v-model="triggerDelay"
            type="number"
            label="Appliquer un délai en secondes"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="showTriggerMenu = false"
          >
            Annuler
          </v-btn>
          <v-btn
            color="primary"
            @click="trigger(triggerDelay);showTriggerMenu = false"
          >
            Déclencher manuellement
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-menu
      v-if="canAdmin"
      v-model="showDeleteMenu"
      :close-on-content-click="false"
      max-width="500"
    >
      <template #activator="{on, attrs}">
        <v-list-item
          v-bind="attrs"
          v-on="on"
        >
          <v-list-item-icon>
            <v-icon color="warning">
              mdi-delete
            </v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>Supprimer</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </template>
      <v-card outlined>
        <v-card-title primary-title>
          Suppression du traitement
        </v-card-title>
        <v-card-text>
          Voulez vous vraiment supprimer le traitement "{{ processing.title }}" et tout son historique ? La suppression est définitive et les données ne pourront pas être récupérées.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="showDeleteMenu = false"
          >
            Non
          </v-btn>
          <v-btn
            color="warning"
            @click="confirmRemove"
          >
            Oui
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-list-item
      v-if="processing.config && processing.config.dataset && processing.config.dataset.id"
      :href="`${env.dataFairUrl}/dataset/${processing.config.dataset.id}`"
      target="_blank"
    >
      <v-list-item-icon>
        <v-icon color="primary">
          mdi-open-in-new
        </v-icon>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>Voir le jeu de données</v-list-item-title>
      </v-list-item-content>
    </v-list-item>

    <v-menu
      v-if="notifUrl && processing.owner.type === activeAccount.type && processing.owner.id === activeAccount.id && !activeAccount.department"
      v-model="showNotifMenu"
      max-width="500"
      min-width="500"
      :close-on-content-click="false"
    >
      <template #activator="{attrs, on}">
        <v-list-item
          v-bind="attrs"
          v-on="on"
        >
          <v-list-item-icon>
            <v-icon color="primary">
              mdi-bell
            </v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>Notifications</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </template>
      <v-card outlined>
        <v-card-title
          primary-title
        >
          Notifications
        </v-card-title>
        <v-card-text class="py-0 px-3">
          <v-iframe :src="notifUrl" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            @click="showNotifMenu = false"
          >
            ok
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
  </v-list>
</template>

<script>

import { mapState, mapGetters } from 'vuex'
import 'iframe-resizer/js/iframeResizer'
import VIframe from '@koumoul/v-iframe'
import eventBus from '../../event-bus'

export default {
  components: { VIframe },
  props: ['processing', 'canAdmin', 'canExec'],
  data: () => ({
    showDeleteMenu: false,
    showNotifMenu: false,
    showTriggerMenu: false,
    triggerDelay: 0,
    webhookKey: null
  }),
  computed: {
    ...mapState(['env']),
    ...mapState('session', ['user']),
    ...mapGetters('session', ['activeAccount']),
    notifUrl () {
      if (!this.env.notifyUrl) return null
      const topics = [
        { key: `processings:processing-finish-ok:${this.processing._id}`, title: `Le traitement ${this.processing.title} a terminé avec succès` },
        { key: `processings:processing-finish-error:${this.processing._id}`, title: `Le traitement ${this.processing.title} a terminé en échec` },
        { key: `processings:processing-log-error:${this.processing._id}`, title: `Le traitement ${this.processing.title} a terminé correctement mais son journal contient des erreurs` }
      ]
      const urlTemplate = window.parent.location.href
      return `${this.env.notifyUrl}/embed/subscribe?key=${encodeURIComponent(topics.map(t => t.key).join(','))}&title=${encodeURIComponent(topics.map(t => t.title).join(','))}&url-template=${encodeURIComponent(urlTemplate)}&register=false`
    },
    webhookLink () {
      let link = `${this.env.publicUrl}/api/v1/processings/${this.processing._id}/_trigger?key=${this.webhookKey}`
      if (this.triggerDelay) link += `&delay=${this.triggerDelay}`
      return link
    }
  },
  watch: {
    showTriggerMenu (v) {
      if (v && this.canAdmin) this.getWebhookKey()
    }
  },
  methods: {
    async confirmRemove () {
      this.showDeleteMenu = false
      try {
        await this.$axios.$delete(`api/v1/processings/${this.processing._id}`)
        this.$router.push('/processings')
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant la suppression du traitement' })
      }
    },
    async trigger (delay) {
      try {
        await this.$axios.$post(`api/v1/processings/${this.processing._id}/_trigger`, null, { params: { delay } })
        this.$emit('triggered')
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant le déclenchement du traitement' })
      }
    },
    async getWebhookKey () {
      this.webhookKey = await this.$axios.$get(`api/v1/processings/${this.processing._id}/webhook-key`)
    }
  }
}
</script>

<style lang="css" scoped>
</style>
