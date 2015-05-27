var Peer = require('simple-peer')
var signalhub = require('signalhub')
var me = require('cuid')()

var hub = signalhub('swarm', ['http://localhost:8080'])

var db = require('./db.js')
global.db = db

var peers = {}

hub.subscribe('all')
  .on('data', function (message) {
    if (me !== message.from) {
      setup(message.from, { initiator: true })
    }
  })

hub.subscribe(me)
  .on('data', function (message) {
    var peer = peers[message.from] || setup(message.from)

    peer.signal(message.signal)
  })

setTimeout(function () {
  hub.broadcast('all', { from: me })
}, 0)

function setup (peerId, opts) {
  var peer = new Peer(opts)
  peers[peerId] = peer

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
    delete peers[peerId]
  })

  peer.on('error', function (err) {
    console.log('error', err)
  })

  return peer
}

function store (peerId, key, value) {
  var peer = peers[peerId]
  if (!peer) return

  peer.send({ type: 'store', key: key, value: value })
}

function findValue (peerId, key) {
  var peer = peers[peerId]
  if (!peer) return

  peer.send({ type: 'findValue', key: key })
}

function storeBroadcast (key, value) {
  Object.keys(peers).forEach(function (peerId) {
    store(peerId, key, value)
  })
}

function broadcast (text) {
  Object.keys(peers).forEach(function (peerId) {
    peers[peerId].send(text)
  })
}

global.store = store
global.broadcast = broadcast
global.findValue = findValue
global.peers = peers

// UI
var domready = require('domready')
var textarea = require('./textarea.js')
var crypto = require('crypto')
var Bacon = require('baconjs').Bacon
global.Bacon = Bacon
var h = require('hyperscript')

domready(function () {
  textarea(document.querySelector('textarea'))
    .on('enter', function (e) {
      var val = e.target.value

      if (val.length > 0) {
        db.put(sha1(val), val)
        storeBroadcast(sha1(val), val)
      }

      e.target.value = ''
    })

  var main = document.querySelector('main')
  function update (el) {
    main.innerHTML = ''
    main.appendChild(el)
  }

  Bacon.fromEvent(db.createReadStream(), 'data').merge(
    Bacon.fromEvent(db, 'put', function (key, value) {
      return { key: key, value: value }
    })
  ).scan([], function (a, b) {
    return a.concat([b])
  }).toProperty().changes().onValue(function (array) {
    update(
      h('ul', array.map(function (data) {
        return h('li', data.key + ': ' + data.value)
      }))
    )
  })
})

function sha1 (text) {
  return crypto.createHash('sha1').update(text).digest('hex')
}
