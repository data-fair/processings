export default async function ({ store, error }) {
  if (!store.state.session || !store.state.session.user) {
    error({
      message: 'Vous devez être connecté pour accéder à cette page',
      statusCode: 401,
    })
  } else if (store.state.session.user.organization && store.state.session.user.organization.role === 'user') {
    error({
      message: 'Vous n\'avez pas les permissions d\'accéder à cette page',
      statusCode: 403,
    })
  }
}
