<template>
  <v-container>
    <v-layout column align-center class="px-5">
      <template v-if="error.statusCode === 404">
        <span class="grey--text text--darken-2 my-5"><v-icon size="64px">mdi-earth-off</v-icon></span>
        <div class="headline grey--text text--darken-2">
          404
        </div>
        <h2 class="display-2 grey--text text--darken-1 my-5">
          La page demandée n'existe pas.
        </h2>
      </template>
      <template v-else-if="error.statusCode === 401 || error.statusCode === 403">
        <span class="grey--text text--darken-2 my-5"><v-icon size="64px">mdi-lock</v-icon></span>
        <div class="headline grey--text text--darken-2 mb-5">
          {{ error.message || `Vous n'avez pas les droits pour accéder à cette page.` }}
        </div>
      </template>
      <template v-else>
        <span class="grey--text text--darken-2 my-5"><v-icon size="64px">mdi-emoticon-sad</v-icon></span>
        <div class="headline grey--text text--darken-2">
          Une erreur indéterminée s'est produite.
        </div>
        <div class="headline grey--text text--darken-2 mb-5">
          Si le problème persiste, vous pouvez nous contacter à <a href="mailto:support@koumoul.com">support@koumoul.com</a>.
        </div>
      </template>
    </v-layout>
  </v-container>
</template>

<script>
export default {
  props: ['error']
}
</script>
