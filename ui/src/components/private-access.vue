<template>
  <v-row class="ma-0">
    <v-checkbox
      v-model="localPatch.public"
      :label="t('public')"
      hide-details
      class="mr-4"
      color="primary"
      density="compact"
      @update:model-value="onChange"
    />
    <v-autocomplete
      v-if="!localPatch.public"
      v-model="localPatch.privateAccess"
      v-model:search="search"
      :items="suggestions"
      :loading="loading ? 'primary' : false"
      :item-title="(item: any) => item && `${item.name || item.id} (${item.type})`"
      :item-value="(item: any) => item && `${item.type}:${item.id}`"
      :label="t('privateAccess')"
      :placeholder="t('searchName')"
      density="compact"
      max-width="500"
      return-object
      hide-details
      hide-no-data
      multiple
      clearable
      @update:model-value="onChange"
    />
  </v-row>
</template>

<i18n lang="yaml">
fr:
  public: Public
  privateAccess: Vue restreinte à des comptes
  searchName: Saisissez un nom d'organisation / un utilisateur
en:
  public: Public
  privateAccess: Restricted access to some accounts
  searchName: Search an organization name / a user name
</i18n>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  patch: {
    type: Object,
    default: () => ({})
  }
})
const emit = defineEmits(['change'])

const { t } = useI18n()

const loading = ref(false)
const search = ref('')
const suggestions = ref([])

const localPatch = ref({ ...props.patch })

watch(localPatch, (newValue) => {
  emit('change', newValue)
}, { deep: true })

watch(search, async () => {
  await listSuggestions()
})

onMounted(async () => {
  if (!localPatch.value.privateAccess) {
    localPatch.value.privateAccess = []
  }
  await listSuggestions()
})

async function listSuggestions () {
  if (!search.value || search.value.length < 3) {
    suggestions.value = localPatch.value.privateAccess
    return
  }

  loading.value = true
  const orgsResponse = await $fetch('/simple-directory/api/organizations', {
    params: { q: search.value },
    baseURL: $sitePath
  })
  const orgs = orgsResponse.results.map((r: any) => ({ ...r, type: 'organization' }))
  const usersResponse = await $fetch('/simple-directory/api/users', {
    params: { q: search.value },
    baseURL: $sitePath
  })
  const users = usersResponse.results.map((r: any) => ({ ...r, type: 'user' }))
  suggestions.value = localPatch.value.privateAccess.concat(orgs, users)
  loading.value = false
}

function onChange () {
  search.value = ''
  loading.value = false
}
</script>
