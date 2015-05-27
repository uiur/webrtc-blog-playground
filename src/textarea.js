var autosize = require('autosize')
var keycode = require('keycode')
var EventEmitter = require('events').EventEmitter

function modifier (e) {
  return e.shiftKey || e.altKey || e.ctrlKey || e.metaKey
}

module.exports = function textarea (element) {
  autosize(element)

  var emitter = new EventEmitter()

  element.addEventListener('keydown', function (e) {
    if (!modifier(e) && keycode(e) === 'enter') {
      e.preventDefault()
      emitter.emit('enter', e)
      autosize.update(e.target)
    }
  })

  return emitter
}
