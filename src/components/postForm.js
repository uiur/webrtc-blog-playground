var h = require('virtual-dom/h')
var Bacon = require('baconjs')

var submitBus = new Bacon.Bus()
var titleBus = new Bacon.Bus()
var bodyBus = new Bacon.Bus()

var titleInput = titleBus.map('.target.value')

var bodyInput = bodyBus.map('.target.value')
var submitEnabled = bodyInput.toProperty('').map(function (value) { return value.length > 0 })

var newEntry = Bacon.combineTemplate({
  title: titleInput.toProperty(''),
  body: body
})

var submit = submitBus.map(newEntry)

var title = titleInput.merge(submit.map('')).toProperty('')
var body = bodyInput.merge(submit.map('')).toProperty('')

function render (state) {
  return h('form.post-form', {
    'ev-submit': function (e) {
      e.preventDefault()
      submitBus.push(e)
    }
  }, [
    h('input.title', {
      type: 'text',
      value: state.title,
      'ev-input': function (e) {
        titleBus.push(e)
      }
    }),
    h('textarea.body', {
      value: state.body,
      'ev-input': function (e) {
        bodyBus.push(e)
      }
    }),
    h('input.button.button-primary.u-full-width', {
      type: 'submit',
      value: ' ',
      disabled: !state.submitEnabled
    })
  ])
}

render.channel = {
  state: Bacon.combineTemplate({
    submitEnabled: submitEnabled,
    title: title,
    body: body
  }),
  submit: submit
}

module.exports = render
