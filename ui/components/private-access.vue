<template>
  <v-row class="ma-0">
    <v-checkbox
      v-model="patch.public"
      :label="t('public')"
      hide-details
      class="ml-2 mb-2 mr-4"
      color="primary"
      @update:model-value="onChange"
    />
    <v-autocomplete
      v-if="!patch.public"
      v-model="patch.privateAccess"
      v-model:search="search"
      :items="suggestions"
      :loading="loading ? 'primary' : false"
      :custom-filter="() => true"
      :multiple="true"
      :clearable="true"
      :item-title="(item) => item && `${item.name || item.id} (${item.type})`"
      :item-value="(item) => item && `${item.type}:${item.id}`"
      :label="t('privateAccess')"
      :placeholder="t('searchName')"
      return-object
      style="max-width:400px;"
      hide-details
      @update:model-value="onChange"
    />
  </v-row>
</template>

<i18n lang="yaml">
fr:
  public: Public
  privateAccess: Vue restreinte à des comptes
  searchName: Saisissez un nom d'organisation
en:
  public: Public
  privateAccess: Restricted access to some accounts
  searchName: Search an organization name
</i18n>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  patch: { type: Object }
})
const emit = defineEmits(['change'])

const { t } = useI18n()

const loading = ref(false)
const search = ref('')
const suggestions = ref([])

watch(search, async () => {
  await listSuggestions()
})

onMounted(async () => {
  if (!props.patch.privateAccess) {
    props.patch.privateAccess = []
    emit('change', props.patch)
  }
  await listSuggestions()
})

async function listSuggestions() {
  if (!search.value || search.value.length < 3) {
    suggestions.value = props.patch.privateAccess
    return
  }

  loading.value = true
  const orgsResponse = await $fetch('/simple-directory/api/organizations', {
    params: { q: search.value }
  })
  const orgs = orgsResponse.results.map(r => ({ ...r, type: 'organization' }))
  const usersResponse = await $fetch('/simple-directory/api/users', {
    params: { q: search.value }
  })
  const users = usersResponse.results.map(r => ({ ...r, type: 'user' }))
  suggestions.value = props.patch.privateAccess.concat(orgs, users)
  emit('change', props.patch)
  loading.value = false
}

function onChange() {
  search.value = ''
  emit('change', props.patch)
}
</script>

<style>
</style>
