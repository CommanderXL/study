const immediate = require('immediate')

const PENDING = 'pending'
const REJECTED = 'rejected'
const RESOLVED = 'resolve'

const handlers = {}
const INTER = function () {}

function Promise(resolver) {
  this.state = 'pending'
  this.value = null
  this.queue = []
  safelyResolveThenable(this, resolver)
}

Promise.prototype.then = function (onFullfilled, onRejected) {
  const promise = new this.constructor(INTER)

  if (this.state !== PENDING) {
    const resolver = this.state === RESOLVED ? onFullfilled : onRejected
    unwrap(promise, resolver, this.value)
  } else {
    this.queue.push(new QueueItem(promise, onFullfilled, onRejected))
  }
}

function QueueItem (promise, onFullfilled, onRejected) {
  this.promise = promise
  if (typeof onFullfilled === 'function') {
    this.onFullfilled = onFullfilled
    this.callFullfilled = this.otherFullfilled
  }

  if (typeof onRejected === 'function') {
    this.onRejected = onRejected
    this.callRejected = this.otherRejected
  }
}

QueueItem.prototype.callFullfilled = function (value) {
  handlers.resolve(this.promise, value)
}

QueueItem.prototype.otherFullfilled = function (value) {
  unwrap(this.promise, this.onFullfilled, value)
}

QueueItem.prototype.callRejected = function () {

}

QueueItem.prototype.otherRejected = function () {

}

function unwrap (promise, func, value) {
  immediate(function () {
    let returnValue
    try {
      returnValue = func(value)
    } catch (e) {
      return handlers.reject(promise, e)
    }
    handlers.resolve(promise, returnValue)
  })
}


handlers.resolve = function (target, value) {
  // 对于thenable的处理
  const _res = tryCatch(getThen, value)
  if (_res.status === 'error') {
    handlers.reject(target, _res.value)
  }
  const thenable = _res.value
  if (thenable) {
    safelyResolveThenable(target, thenable)
  } else {
    target.state = RESOLVED
    target.value = value
    let i = -1
    let len = this.queue.length
    while (++i < len) {
      target.queue[i].callFullfilled(value)
    }
  }
}

handlers.reject = function (target, value) {

}

function getThen (obj) {
  const then = obj && obj.then
  if (then && typeof then === 'function') {
    return function () {
      then.apply(obj, arguments)
    }
  }
}

function tryCatch (func, value) {
  let ret = {}
  try {
    ret.value = func(value)
    ret.status = 'success'
  } catch (e) {
    ret.value = e
    ret.status = 'error'
  }
  return ret
}

function safelyResolveThenable (target, resolver) {
  let called = false
  function onError (value) {
    if (called) return
    called = true
    handlers.reject(target, value)
  }

  function onSuccess (value) {
    if (called) return
    called = true
    handlers.resolve(target, value)
  }

  resolver(onSuccess, onError)
}