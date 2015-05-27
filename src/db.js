var levelup = require('levelup')
module.exports = levelup('peer', { db: require('level-js') })
