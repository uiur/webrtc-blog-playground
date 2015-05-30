var Promise = require('es6-promise').Promise

var inherits = require('util').inherits
var EventEmitter = require('events').EventEmitter

function Peer (wire) {
  var self = this
  this.wire = wire

  wire.on('data', function (message) {
    self.emit(message.type + '.' + message.method, message)
  })
}
inherits(Peer, EventEmitter)

Peer.prototype.store = function (key, value) {
  this.wire.send({ type: 'req', method: 'store', key: key, value: value })
}

Peer.prototype.findValue = function (key) {
  var self = this

  return new Promise(function (resolve, reject) {
    self.wire.send({ type: 'req', method: 'findValue', key: key })
    self.once('res.findValue', function (message) {
      resolve(message.value)
    })
  })
}

function Swarm () {
  this.peerMap = {}
}
inherits(Swarm, EventEmitter)

Swarm.prototype.add = function (id, simplePeer) {
  var self = this
  var peer = new Peer(simplePeer)

  simplePeer.on('data', function (message) {
    self.emit(message.type + '.' + message.method, message, peer)
  })

  this.peerMap[id] = peer

  return this
}

Swarm.prototype.peers = function () {
  var self = this

  return Object.keys(self.peerMap).map(function (peerId) {
    return self.peerMap[peerId]
  })
}

Swarm.prototype.storeBroadcast = function (key, value) {
  this.peers().forEach(function (peer) {
    peer.store(key, value)
  })
}

module.exports = new Swarm()
