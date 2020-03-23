<template lang="html">
  <div>
    <v-layout column style="position:fixed;right:2px;z-index:10" v-if="issue">
      <!-- <view-resource :resource="issue" :fab="true" type="issues" />
      <clone-resource :resource="issue" :fab="true" type="issues" @created="$router.push({name: 'issues-id-edit', params:{id: $event.id}})"/>
      <remove-resource :resource="issue" :fab="true" type="issues" @removed="$router.push({name: 'issues'})"/> -->
    </v-layout>
    <v-container v-if="issue" grid-list-xl fluid>
      <nuxt-link :to="{name: 'embed-issues'}">
        Retour à la liste des demandes d'assistance
      </nuxt-link>
      <v-layout wrap>
        <v-flex xs12 sm6 md8 lg9>
          <section-title :text="issue.title" />
          <div v-html="renderedDescription" />
        </v-flex>
        <v-flex xs12 sm6 md4 lg3>
          <v-card>
            <v-card-title class="title">
              Statut<v-spacer /><v-chip color="primary">
                {{ statusLabel[issue.status] }}
              </v-chip>
            </v-card-title>
            <v-list dense>
              <v-list-item>
                <v-list-item-avatar v-if="issue.category === 'bug'">
                  <v-icon>mdi-bug</v-icon>
                </v-list-item-avatar>
                <v-list-item-avatar v-else-if="issue.category === 'question'">
                  <v-icon>mdi-help</v-icon>
                </v-list-item-avatar>
                <v-list-item-avatar v-else-if="issue.category === 'feature'">
                  <v-icon>mdi-boom-gate-up</v-icon>
                </v-list-item-avatar>
                <v-list-item-content>
                  <v-list-item-title>
                    Criticité
                    <span v-if="issue.criticity === 'low'" class="success--text">faible</span>
                    <span v-if="issue.criticity === 'medium'" class="warning--text">moyenne</span>
                    <span v-if="issue.criticity === 'high'" class="error--text">importante</span>
                  </v-list-item-title>
                </v-list-item-content>
              </v-list-item>
              <v-list-item>
                <v-list-item-avatar><v-icon>mdi-account-plus</v-icon></v-list-item-avatar>
                <v-list-item-content>
                  <v-list-item-title>Créé {{ issue.created.date | moment('from') }}</v-list-item-title>
                </v-list-item-content>
              </v-list-item>
              <v-list-item>
                <v-list-item-avatar><v-icon>mdi-update</v-icon></v-list-item-avatar>
                <v-list-item-content>
                  <v-list-item-title>Mis à jour {{ issue.updated.date | moment('from') }}</v-list-item-title>
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-card>
        </v-flex>
      </v-layout>

      <section-subtitle text="Commentaires" />
      <v-list three-line class="transparent">
        <v-list-item v-for="(comment, i) in issue.comments" :key="i">
          <v-list-item-content>
            <div v-html="comment.renderedText" />
            <v-list-item-subtitle>
              Rédigé par <span class="warning--text"> {{ comment.name }}</span>
              le {{ comment.date | moment('DD/MM/YYYY') }} à {{ comment.date | moment('HH:mm') }}
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <v-menu v-model="addCommentMenu" min-width="500" :close-on-content-click="false">
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" color="primary">
            Ajouter un commentaire
          </v-btn>
        </template>
        <v-card>
          <v-card-title class="title">
            Commentaire a ajouter
          </v-card-title>

          <v-card-text>
            <v-textarea v-model="newComment.text" label="Commentaire" filled rows="5" />
          </v-card-text>

          <v-divider />

          <v-card-actions>
            <v-spacer />
            <v-btn text @click.native="addCommentMenu = false">
              Annuler
            </v-btn>
            <v-btn :disabled="!newComment.text" @click.native="addComment()">
              Ajouter
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>
    </v-container>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import eventBus from '~/event-bus.js'
const marked = require('marked')
const renderer = new marked.Renderer()
const linkRenderer = renderer.link
renderer.link = (href, title, text) => {
  const html = linkRenderer.call(renderer, href, title, text)
  return html.replace(/^<a /, '<a target="_blank" rel="nofollow" ')
}

export default {
  layout: 'embed',
  middleware: 'orga-admin',
  data: () => ({
    issue: null,
    newComment: {},
    addCommentMenu: false,
    editCommentMenu: {},
    renderedDescription: '',
    statusLabel: {
      created: 'Créé',
      analyze: 'Analysé',
      processing: 'En cours de traitement',
      review: 'En attente de retour',
      closed: 'Cloturé'
    }
  }),
  computed: {
    ...mapState('session', ['user'])
  },
  async mounted() {
    this.refresh()
  },
  methods: {
    async patch(patch) {
      Object.keys(patch).forEach(k => { patch[k] = patch[k] || null })
      try {
        this.issue = await this.$axios.$patch(process.env.publicUrl + '/api/v1/issues/' + this.$route.params.id, patch)
        this.renderComments()
        eventBus.$emit('notification', 'La description du ticket a bien été mise à jour.')
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant la mise à jour de la description du ticket:' })
      }
    },
    async addComment() {
      try {
        await this.$axios.$post(process.env.publicUrl + '/api/v1/issues/' + this.$route.params.id, this.newComment)
        this.newComment = {}
        this.refresh()
        eventBus.$emit('notification', 'Le commentaire a bien été ajouté au ticket')
      } catch (error) {
        eventBus.$emit('notification', { error, msg: 'Erreur pendant l\'ajout du commentaire au ticket:' })
      }

      this.addCommentMenu = false
    },
    async refresh() {
      this.issue = await this.$axios.$get(process.env.publicUrl + '/api/v1/issues/' + this.$route.params.id)
      this.renderComments()
      this.renderedDescription = marked(this.issue.description || '', { renderer })
    },
    renderComments() {
      this.issue.comments = this.issue.comments || []
      this.issue.comments.forEach(comment => {
        comment.renderedText = marked(comment.text || '', { renderer })
      })
    }
  }
}
</script>
