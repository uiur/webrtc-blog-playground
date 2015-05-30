var Peer = require('simple-peer')
var signalhub = require('signalhub')
var hub = signalhub('swarm', ['http://localhost:8080'])
var me = require('cuid')()

var db = require('./db.js')
var sha1 = require('./sha1.js')
var inherits = require('util').inherits
var EventEmitter = require('events').EventEmitter

function Swarm () {
  this.peers = {}
}

inherits(Swarm, EventEmitter)

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
    self.emit('data', message, peer)
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
