var Promise = require('es6-promise').Promise

var db = require('./db.js')
global.db = db

var sha1 = require('./sha1.js')
var Swarm = require('./swarm.js')
var swarm = new Swarm()
swarm.setup()

swarm.on('data', function (message, peer) {
  swarm.emit(message.type + '.' + message.method, message, peer)
})

swarm.on('req.store', function (message) {
  if (message.key !== sha1(message.value)) return

  db.put(message.key, message.value)
})

swarm.on('req.findValue', function (message, peer) {
  db.get(message.key, function (err, value) {
    if (err) return console.log(err)

    peer.send({
      type: 'res',
      method: 'findValue',
      key: message.key,
      value: value
    })
  })
})

// rpc
function store (peerId, key, value) {
  var peer = swarm.peers[peerId]
  if (!peer) return

  peer.send({ type: 'req', method: 'store', key: key, value: value })
}

function findValue (peerId, key) {
  return new Promise(function (resolve, reject) {
    var peer = swarm.peers[peerId]
    if (!peer) reject()

    peer.send({ type: 'req', method: 'findValue', key: key })

    swarm.once('res.findValue', function (message) {
      db.put(message.key, message.value, resolve)
    })
  })
}

function storeBroadcast (key, value) {
  Object.keys(swarm.peers).forEach(function (peerId) {
    store(peerId, key, value)
  })
}

global.store = store
global.findValue = findValue

// wrapper

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
        h('p', entry.id),
        h('p.article-body', entry.body)
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
        if (err) {
          setTimeout(function () {
            var peerIds = Object.keys(swarm.peers)
            Promise.race(peerIds.map(function (peerId) {
              return findValue(peerId, entryId)
            })).then(function (err, value) {
              if (err) console.log(err)
              var entry = { id: entryId, body: value }
              update(render({ entry: entry, entries: array }))
            })
          }, 1000)

          return
        }

        var entry = { id: entryId, body: value }
        update(render({ entry: entry, entries: array }))
      })
    } else {
      update(render({ entries: array }))
    }
  })
})
