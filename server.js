var http = require('http')
var fs = require('fs')
var url = require('url')

http.createServer(function (req, res) {
  function notFound () {
    res.writeHead(404)
    res.end()
  }

  var pathname = url.parse(req.url).pathname

  if ((/^\/(?:[0-9a-f]{40})?$/).test(pathname)) {
    fs.createReadStream(__dirname + '/index.html').pipe(res)
  } else {
    var stream = fs.createReadStream(__dirname + pathname).on('error', notFound)

    stream.pipe(res)
  }
}).listen(3001)
