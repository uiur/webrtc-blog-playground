var Promise = require('es6-promise').Promise

var db = require('./db.js')
global.db = db

var sha1 = require('./sha1.js')

var webrtcSwarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var hub = signalhub('swarm', ['http://localhost:8080'])
var sw = webrtcSwarm(hub)

var Swarm = require('./swarm.js')

sw.on('peer', function (peer, id) {
  Swarm.add(id, peer)
})

Swarm.on('req.store', function (message) {
  if (message.key !== sha1(message.value)) return

  db.put(message.key, message.value)
})

Swarm.on('req.findValue', function (message, peer) {
  db.get(message.key, function (err, value) {
    if (err) return console.log(err)

    peer.wire.send({
      type: 'res',
      method: 'findValue',
      key: message.key,
      value: value
    })
  })
})

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
        Swarm.storeBroadcast(sha1(val), val)
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
            Promise.race(Swarm.peers().map(function (peer) {
              return peer.findValue(entryId)
            })).then(function (value) {
              db.put(entryId, value)

              var entry = { id: entryId, body: value }
              update(render({ entry: entry, entries: array }))
            }).catch(function (err) {
              console.error(err)
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
