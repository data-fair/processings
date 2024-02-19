const middleware = {}

middleware['superadmin-required'] = require('../middleware/superadmin-required.js')
middleware['superadmin-required'] = middleware['superadmin-required'].default || middleware['superadmin-required']

export default middleware
