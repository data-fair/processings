const middleware = {}

middleware['admin-required'] = require('../public/middleware/admin-required.js')
middleware['admin-required'] = middleware['admin-required'].default || middleware['admin-required']

middleware['breadcrumbs'] = require('../public/middleware/breadcrumbs.js')
middleware['breadcrumbs'] = middleware['breadcrumbs'].default || middleware['breadcrumbs']

middleware['contrib-required'] = require('../public/middleware/contrib-required.js')
middleware['contrib-required'] = middleware['contrib-required'].default || middleware['contrib-required']

middleware['superadmin-required'] = require('../public/middleware/superadmin-required.js')
middleware['superadmin-required'] = middleware['superadmin-required'].default || middleware['superadmin-required']

export default middleware
