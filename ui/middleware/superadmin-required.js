export default async function ({ store, error }) {
  if (!store.session || !store.session.user) {
    // the error page will trigger a login when receiving this statusCode
    return error({ message: 'Authentification nécessaire', statusCode: 401 })
  } else if (!store.session.user.adminMode) {
    return error({
      message: 'Vous n\'avez pas la permission d\'accéder à cette page, il faut avoir activé le mode super-administration.',
      statusCode: 403
    })
  }
}
