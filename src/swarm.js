var Peer = require('simple-peer')
var signalhub = require('signalhub')
var hub = signalhub('swarm', ['http://localhost:8080'])
var me = require('cuid')()

var db = require('./db.js')
var sha1 = require('./sha1.js')

function Swarm () {
  this.peers = {}
}

Swarm.prototype.setup = function () {
  var self = this

  hub.subscribe('all')
    .on('data', function (message) {
      if (me !== message.from) {
        self.add(message.from, { initiator: true })
      }
    })

  hub.subscribe(me)
    .on('data', function (message) {
      var peer = self.peers[message.from] || self.add(message.from)

      peer.signal(message.signal)
    })

  setTimeout(function () {
    hub.broadcast('all', { from: me })
  }, 0)
}

Swarm.prototype.add = function (peerId, opts) {
  var self = this

  var peer = new Peer(opts)
  this.peers[peerId] = peer

  peer.on('signal', function (data) {
    hub.broadcast(peerId, { from: me, signal: data })
  })

  peer.on('connect', function () {
    console.log('connect!')
  })

  peer.on('data', function (message) {
    console.log('data:', message)

    if (message.type === 'store') {
      if (message.key !== sha1(message.value)) return

      db.put(message.key, message.value)
    } else if (message.type === 'findValue' && message.value === undefined) {
      db.get(message.key, function (err, value) {
        if (err) return console.log(err)

        peer.send({
          type: 'findValue',
          key: message.key,
          value: value
        })
      })
    }
  })

  peer.on('close', function () {
    delete self.peers[peerId]
  })

  peer.on('error', function (err) {
    console.log('error', err)
  })

  return peer
}

module.exports = Swarm
