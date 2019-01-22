const PENDING = ['pending']
const FULFILLED = ['fulfilled']
const REJECT = ['reject']
function noop() {}

const handler = {
  resolve(self, value) {
    if (isThenable(value)) {
      salflyResolveThenable(self, value)
    } else {
      self.state = FULFILLED
      self.outcome = value
      self.queue.forEach(item => item.callFulfilled(value))
    }

    return self
  },
  reject() {

  }
}

function Promise(resolver) {
  this.state = PENDING
  this.outcome = ''
  this.queue = []

  if (resolver !== noop) {
    salflyResolveThenable(this, resolver)
  }  
}

Promise.prototype.then = function (onFulFilled, onRejected) {
  if (typeof onFulFilled !== 'function' && this.state === FULFILLED ||
    typeof onRejected !== 'function' && this.state === REJECT) {
      return
    }

    const promise = new this.constructor(noop)

    if (this.state !== PENDING) {
      const resolver = this.state === FULFILLED ? onFulFilled : onRejected
      unwrap(promise, resolver, this.outcome)
    } else {
      this.queue.push(new QueueItem(promise, onFulFilled, onRejected))
    }

    return promise
}

Promise.prototype.reject = function () {

}

function salflyResolveThenable(self, thenable) {
  let called = false

  function resolve(val) {
    if (called) {
      return
    }
    called = true
    handler.resolve(self, val)
  }

  function reject(val) {
    if (called) {
      return
    }
    called = true
    handler.reject(self, val)
  }

  thenable(resolve, reject)
}

function tryCatch(fn, value) {

}

function unwrap(promise, fn, value) {
  setTimeout(() => {
    const res = fn(value)

    if (res === promise) {
      handler.reject(promise, new TypeError('can\'t resolve the promise self'))
    } else {
      handler.resolve(promise, res)
    }
  }, 0)
}