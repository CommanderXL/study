function _EventEmitter () {
  this._events = Object.create(null)
}

_EventEmitter.prototype.on = function (type, listener) {
  if (typeof listener !== 'function') {
    return this
  }
  let events = this._events[type]
  if (events === undefined) {
    this._events[type] = []
  }
  this._events[type].push(listener)
}

_EventEmitter.prototype.emit = function (type, ...args) {
  const handlers = this._events[type]
  if (handlers === undefined) {
    return false
  }
  const len = handlers.length
  const listeners = arrayClone(handlers, len)
  for (let i = 0; i < len; i++) {
    listeners[i].apply(this, args)
  }
  return true
}

_EventEmitter.prototype.off = function (type, listener) {
  const handlers = this._events[type]
  if (handlers === undefined) {
    return false
  }
  const len = handlers.length
  let position = -1
  for (let i = len - 1; i >= 0; i--) {
    // 使用listener属性保存对listener的引用
    if (listener === handlers[i] || listener === handlers[i].listener) {
      position = i
      break
    }
  }

  if (position < 0) {
    return this
  }

  if (position === 0) {
    handlers.shift()
  } else {
    spliceOn(handlers, position)
  }
}

_EventEmitter.prototype.once = function (type, listener) {
  this.on(type, _onceWrap.call(this, type, listener))
}

function _onceWrap (type, listener) {
  const state = { target: this, type, listener, wrapFn: undefined }
  const wrapped = onceWrapper.bind(state)
  wrapped.listener = listener
  state.wrapFn = wrapped
  return wrapped
}

function onceWrapper () {
  this.target.off(this.type, this.wrapFn)
  Reflect.apply(this.listener, this, arguments)
}

function arrayClone (origin, n) {
  let arr = new Array(n)
  for (let i = 0; i < n; i++) {
    arr[i] = origin[i]
  }
  return arr
}

// 比常规的Array.prototype.splice方法更快
function spliceOn (arr, index) {
  for (let i = index, j = index + 1; j < arr.length; i++, j++) {
    arr[i] = arr[j]
  }
  arr.pop()
}

var event = new _EventEmitter()
event.once('a', (data) => {
  console.log(data)
})

setTimeout(() => {
  event.emit('a', 123)
}, 1000)
setTimeout(() => {
  event.emit('a', 123)
}, 2000)
