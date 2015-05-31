var h = require('virtual-dom/h')
var moment = require('moment')

module.exports = function render (entry) {
  return h('article', [
    h('p.article-body', entry.body),
    h('p.article-timestamp', moment(new Date(entry.timestamp)).fromNow())
  ])
}
