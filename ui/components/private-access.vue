<template>
  <v-row class="ma-0">
    <v-checkbox
      v-model="localPatch.value.public"
      :label="$t('public')"
      hide-details
      class="ml-2 mb-2 mr-4"
      @update:model-value="onChange"
    />
    <v-autocomplete
      v-if="!localPatch.value.public"
      v-model="localPatch.value.privateAccess"
      v-model:search="search"
      :items="suggestions"
      :loading="loading ? 'primary' : false"
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
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from '~/store/index'

const props = defineProps(['patch'])
const emit = defineEmits(['change'])

const store = useStore()
const env = computed(() => store.env)
const loading = ref(false)
const localPatch = ref({ ...props.patch })
const search = ref('')
const suggestions = ref([])

watch(search, async () => {
  await listSuggestions()
})

onMounted(async () => {
  if (!props.patch.privateAccess) {
    emit('change', { ...props.patch, privateAccess: [] })
  }
  await listSuggestions()
})

async function listSuggestions() {
  if (!search.value || search.value.length < 3) {
    suggestions.value = props.patch.privateAccess
    return
  }

  loading.value = true
  const orgsResponse = await $fetch(`${env.value.directoryUrl}/api/organizations`, {
    params: { q: search.value }
  })
  const orgs = orgsResponse.map(r => ({ ...r, type: 'organization' }))
  const usersResponse = await $fetch(`${env.value.directoryUrl}/api/users`, {
    params: { q: search.value }
  })
  const users = usersResponse.map(r => ({ ...r, type: 'user' }))
  suggestions.value = [...new Set([...props.patch.privateAccess, ...orgs, ...users])]
  loading.value = false
}

function onChange() {
  search.value = ''
  emit('change', localPatch.value)
}
</script>

<style>
</style>
