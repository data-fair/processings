<template>
  <v-row class="ma-0">
    <v-checkbox
      v-model="patch.public"
      :label="$t('public')"
      hide-details
      class="ml-2 mb-2 mr-4"
      @update:model-value="$emit('change')"
    />
    <v-autocomplete
      v-if="!patch.public"
      v-model="patch.privateAccess"
      v-model:search="search"
      :items="suggestions"
      :loading="loading"
      :custom-filter="() => true"
      :multiple="true"
      :clearable="true"
      :item-title="(item) => item && `${item.name || item.id} (${item.type})`"
      :item-value="(item) => item && `${item.type}:${item.id}`"
      :label="$t('privateAccess')"
      :placeholder="$t('searchName')"
      return-object
      style="max-width:400px;"
      hide-details
      @update:model-value="onChange"
    />
  </v-row>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useStore } from '~/store/index'

const props = defineProps(['patch'])
const emit = defineEmits(['change'])

const store = useStore()
const env = computed(() => store.env)
const loading = ref(false)
const search = ref('')
const suggestions = ref([])

watch(search, () => {
  listSuggestions()
})

// Initialize privateAccess if not already done
if (!props.patch.privateAccess) {
  props.patch.privateAccess = []
}

// Convert to setup-style lifecycle hook
onMounted(() => {
  listSuggestions()
})

async function listSuggestions() {
  if (!search.value || search.value.length < 3) {
    suggestions.value = props.patch.privateAccess
    return
  }

  loading.value = true
  const orgsResponse = await store.$axios.$get(`${env.value.directoryUrl}/api/organizations`, { params: { q: search.value } })
  const orgs = orgsResponse.results.map(r => ({ ...r, type: 'organization' }))
  const usersResponse = await store.$axios.$get(`${env.value.directoryUrl}/api/users`, { params: { q: search.value } })
  const users = usersResponse.results.map(r => ({ ...r, type: 'user' }))
  suggestions.value = [...new Set([...props.patch.privateAccess, ...orgs, ...users])]
  loading.value = false
}

function onChange() {
  search.value = ''
  emit('change')
}
</script>

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

<style>

</style>
