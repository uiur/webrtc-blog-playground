var Promise = require('es6-promise').Promise

var db = require('./db.js')
global.db = db

var extend = require('xtend')

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
  if (message.key !== sha1(JSON.stringify(message.value))) return

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

function findEntry (id) {
  return new Promise(function (resolve, reject) {
    db.get(id, function (err, value) {
      if (err) {
        setTimeout(function () {
          Promise.race(Swarm.peers().map(function (peer) {
            return peer.findValue(id)
          })).then(function (value) {
            db.put(id, value)

            resolve(value)
          }).catch(console.error.bind(console))
        }, 1000)
      } else {
        resolve(value)
      }
    })
  })
}

function publishEntry (value) {
  var id = sha1(JSON.stringify(value))

  db.put(id, value)
  Swarm.storeBroadcast(id, value)
}

// UI
var domready = require('domready')
var textarea = require('./textarea.js')
var Bacon = require('baconjs').Bacon
global.Bacon = Bacon

var mainLoop = require("main-loop")
var h = require("virtual-dom/h")

var moment = require('moment')

function render (state) {
  function renderEntry (entry) {
    return h('article', [
      h('p.article-body', entry.body),
      h('p.article-timestamp', moment(new Date(entry.timestamp)).fromNow())
    ])
  }

  return h('div', [
    state.entry ? renderEntry(state.entry) : null,
    h('ul', state.entries.map(function (data) {
      return h('li', [
        h('a', { href: '/' + data.key }, data.key)
      ])
    }))
  ])
}

var initState = { entries: [] }

var loop = mainLoop(initState, render, {
  create: require('virtual-dom/create-element'),
  diff: require('virtual-dom/diff'),
  patch: require('virtual-dom/patch')
})

domready(function () {
  document.querySelector('main').appendChild(loop.target)
})

// textarea(document.querySelector('textarea'))
//   .on('enter', function (e) {
//     var val = e.target.value
//
//     if (val.length > 0) {
//       publishEntry({ body: val, timestamp: Date.now() })
//     }
//
//     e.target.value = ''
//   })

Bacon.fromEvent(db.createReadStream(), 'data').merge(
  Bacon.fromEvent(db, 'put', function (key, value) {
    return { key: key, value: value }
  })
).scan([], function (a, b) {
  return a.concat([b])
}).toProperty().changes().onValue(function (array) {
  var entryId = window.location.pathname.slice(1)

  if (entryId.length > 0) {
    findEntry(entryId).then(function (value) {
      var entry = extend(value, { id: entryId })
      loop.update({ entry: entry, entries: array })
    })
  } else {
    loop.update({ entries: array })
  }
})
