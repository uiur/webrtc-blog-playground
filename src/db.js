var levelup = require('levelup')

module.exports = levelup('webrtc-blog', {
  db: require('level-js'),
  valueEncoding: 'json'
})
