module.exports = route => (req, res, next) => route(req, res, next).catch(next)
