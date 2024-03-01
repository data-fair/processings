import { useStore } from '~/store/index'

export default defineNuxtRouteMiddleware(async () => {
  const store = useStore()

  if (!store.user) {
    return store.error({ message: 'Authentification nécessaire', statusCode: 401 })
  } else if (!store.isAccountAdmin()) {
    return store.error({
      message: 'Vous n\'avez pas la permission d\'accéder à cette page, il faut avoir activé le mode super-administration.',
      statusCode: 403
    })
  }
})
