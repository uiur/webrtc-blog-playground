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

            resolve(extend(value, { id: id }))
          }).catch(console.error.bind(console))
        }, 1000)
      } else {
        resolve(extend(value, { id: id }))
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
var Bacon = require('baconjs').Bacon
global.Bacon = Bacon

var mainLoop = require('main-loop')
var h = require('virtual-dom/h')

require('dom-delegator')()

var renderEntry = require('./components/entry.js')
var postForm = require('./components/postForm.js')

postForm.channel.submit.onValue(function (entry) {
  publishEntry(entry)
})

function render (state) {
  return h('div', [
    state.entry ? renderEntry(state.entry) : null,
    h('ul', state.entries.map(function (data) {
      return h('li', [
        h('a', { href: '/' + data.key }, data.key)
      ])
    })),
    postForm(state.form)
  ])
}

var currentState = { entries: [], form: { submitEnabled: false } }

var loop = mainLoop(currentState, render, {
  create: require('virtual-dom/create-element'),
  diff: require('virtual-dom/diff'),
  patch: require('virtual-dom/patch')
})

domready(function () {
  document.querySelector('main').appendChild(loop.target)
})

var entries = Bacon.fromEvent(db.createReadStream(), 'data').merge(
  Bacon.fromEvent(db, 'put', function (key, value) {
    return { key: key, value: value }
  })
).scan([], function (a, b) {
  return a.concat([b])
}).toProperty().changes()

var entryId = Bacon.constant(window.location.pathname.slice(1)).filter(function (id) {
  return id.length > 0
})

var entry = entryId.flatMap(function (entryId) {
  return Bacon.fromPromise(findEntry(entryId))
}).toProperty(null)

Bacon.combineTemplate({
  entry: entry,
  entries: entries,
  form: postForm.channel.state
}).changes().onValue(function (state) {
  console.log('state', state)
  loop.update(state)
})
