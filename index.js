const util = require('util')
const events = require('events')

const WebSocket = require('ws')
const defaultOptions = {
  url: 'ws://stream.tradingeconomics.com/',

  key: 'guest',
  secret: 'guest',
  reconnect: true, // reconnect on error/disconnect
  reconnect_timeout: 30000, // time (in miliseconds) to wait before attepmt to reconect
  onMessage: function () {
  },
  onError: function () {
  }
}

const TEClient = function (options) {
  events.EventEmitter.call(this)

  this.userOptions = options || {}
  this.init.apply(this)

  return this
}

util.inherits(TEClient, events.EventEmitter)

TEClient.prototype.init = function () {
  const _this = this

  _this.options = merge(defaultOptions, _this.userOptions)
  _this.subArr = [] // ["calendar"]

  _this.connect.apply(this)

  return _this
}

TEClient.prototype.connect = function () {
  const _this = this
  const options = _this.options
  const url = buildWsUrl(options)

  console.log('\n Connecting to ', url)
  _this.ws = new WebSocket(url)

  _this.ws.on('open', function () {
    console.log('SOCKET CONNECTED')
    // subscribe to our list
    _this.subArr.forEach(function (subject) {
      _this.ws.send(`{"topic": "subscribe", "to": "${subject}"}`)
    })
  })

  _this.ws.on('message', function (data) {
    try {
      const aux = JSON.parse(data)

      if (aux.topic && aux.topic !== 'keepalive') {
        _this.emit('message', aux)
      }
    } catch (err) {
      console.log(err)
    }
  })

  _this.ws.on('close', function () {
    console.log('SOCKET CLOSED')
    if (options.reconnect) {
      console.log('Trying to reconnect in ', options.reconnect_timeout)
      setTimeout(function () {
        _this.connect()
      }, options.reconnect_timeout)
    }
  })

  _this.ws.on('error', function () {
    console.log('ERROR')
    if (options.reconnect) {
      console.log('Trying to reconnect in ', options.reconnect_timeout)
      setTimeout(function () {
        _this.connect()
      }, options.reconnect_timeout)
    }
  })

  return _this
}

TEClient.prototype.subscribe = function (to) {
  const _this = this

  if (_this.subArr.indexOf(to) < 0) {
    _this.subArr.push(to)
  }

  if (!_this.ws || _this.ws.readyState !== WebSocket.OPEN) {
    // #todo -> emit error
    return _this
  }

  _this.ws.send(`{"topic": "subscribe", "to": "${to}"}`)

  return _this
}

module.exports = TEClient

function buildWsUrl (options) {
  let url = options.url

  url += ('?client=' + options.key + ':' + options.secret)

  return url
}

/**
 * Deep merge two or more objects and return a third object. If the first argument is
 * true, the contents of the second object is copied into the first object.
 * First, it deep merged arrays, which lead to workarounds in Highcharts. Second,
 * it copied properties from extended prototypes.
 */
function merge () {
  let i
  let args = arguments
  let ret = {}
  const doCopy = function (copy, original) {
    var value, key

    // An object is replacing a primitive
    if (typeof copy !== 'object') {
      copy = {}
    }

    for (key in original) {
      if (Object.prototype.hasOwnProperty.call(original, key)) {
        value = original[key]

        // Copy the contents of objects, but not arrays or DOM nodes
        if (value && typeof value === 'object' && Object.prototype.toString.call(value) !== '[object Array]' &&
                    key !== 'renderTo' && typeof value.nodeType !== 'number') {
          copy[key] = doCopy(copy[key] || {}, value)

          // Primitives and arrays are copied over directly
        } else {
          copy[key] = original[key]
        }
      }
    }
    return copy
  }

  // If first argument is true, copy into the existing object. Used in setOptions.
  if (args[0] === true) {
    ret = args[1]
    args = Array.prototype.slice.call(args, 2)
  }

  // For each argument, extend the return
  const len = args.length
  for (i = 0; i < len; i++) {
    ret = doCopy(ret, args[i])
  }

  return ret
}
