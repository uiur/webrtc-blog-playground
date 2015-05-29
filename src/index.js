var db = require('./db.js')
global.db = db

var sha1 = require('./sha1.js')
var Swarm = require('./swarm.js')
var swarm = new Swarm()
swarm.setup()

function store (peerId, key, value) {
  var peer = swarm.peers[peerId]
  if (!peer) return

  peer.send({ type: 'store', key: key, value: value })
}

function findValue (peerId, key) {
  var peer = swarm.peers[peerId]
  if (!peer) return

  peer.send({ type: 'findValue', key: key })
}

function storeBroadcast (key, value) {
  Object.keys(swarm.peers).forEach(function (peerId) {
    store(peerId, key, value)
  })
}

function broadcast (text) {
  Object.keys(swarm.peers).forEach(function (peerId) {
    swarm.peers[peerId].send(text)
  })
}

global.store = store
global.broadcast = broadcast
global.findValue = findValue

// UI
var domready = require('domready')
var textarea = require('./textarea.js')
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

  function render (state) {
    function renderEntry (entry) {
      return h('article', [
        h('h1', entry.id),
        h('pre', entry.body)
      ])
    }

    return h('div', [
      state.entry ? renderEntry(state.entry) : null,
      h('ul', state.entries.map(function (data) {
        return h('li', data.key + ': ' + data.value)
      }))
    ])
  }

  Bacon.fromEvent(db.createReadStream(), 'data').merge(
    Bacon.fromEvent(db, 'put', function (key, value) {
      return { key: key, value: value }
    })
  ).scan([], function (a, b) {
    return a.concat([b])
  }).toProperty().changes().onValue(function (array) {
    var entryId = window.location.pathname.slice(1)

    if (entryId.length > 0) {
      db.get(entryId, function (err, value) {
        if (err) return console.log(err)

        var entry = { id: entryId, body: value }

        update(render({ entry: entry, entries: array }))
      })
    } else {
      update(render({ entries: array }))
    }
  })
})
