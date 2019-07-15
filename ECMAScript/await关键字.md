# await 关键字

不知道大家在平时使用 async/await 语法进行异步 -> 同步操作过程有没有考虑过这样一个问题：

await 关键字后面可以使用 promise，当这个 promise 被 resolve 后，我们是可以直接获取到 resolve 的值。

```javascript
async function demo1() {
  const num = await Promise.resolve(1) // num 为1
}
```

但是在平时我们使用 promise 的过程中，由于 promise 是一个异步的操作，因此是无法直接获取其被 resolve 的值的，除非是在 promise.then 方法中传入的回调当中才能获取得到。

```javascript
const num = Promise.resolve(1) // num 此时为一个被 resolved 的 promise，而非 1

num.then(val => console.log(val)) // 输出1
```

async/await 语法规则就是这样定义的，在一些不支持 async/await 语法的浏览器当中如果想使用的话，必须借助 babel 这样的代码转化工具就能实现 async/await 所具备的功能，将一系列的异步操作任务转化为同步操纵。

那么 babel 是如何实现这样的能直接获取到 await 关键字后面的 promise 被 resolve 后的值的呢？

我们首先来看个例子：

```javascript
const fetchData = data =>
  new Promise(resolve => setTimeout(resolve, 1000, data + 1))

const fetchValue = async function() {
  const value1 = await fetchData(1)
  const value2 = await fetchData(value1)
  const value3 = await fetchData(value2)
  console.log(value3)
}

fetchValue()
// 大约 3s 后输出 4
```

这段代码经过 babel 的编译转化工作，最终产出的代码为：

```javascript
'use strict'

// 将 async 进行 generator 化之后单步执行任务的方法
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  // 取 generator 这次执行后的 value
  try {
    var info = gen[key](arg)
    var value = info.value
  } catch (error) {
    reject(error)
    return
  }
  // 如果这个异步队列执行完后，那么就会 resolve 这个值
  if (info.done) {
    resolve(value)
  } else {
    // 如果异步队列还未执行完，那么就需要后面的任务放到下一个 mircoTask 里面去执行，等上一个异步任务执行完后才会执行后面的任务
    Promise.resolve(value).then(_next, _throw)
  }
}

// 返回一个匿名函数，这个匿名函数内部使用 Promise 进行一层包裹。即将 async 进行 generator 化
function _asyncToGenerator(fn) {
  return function() {
    var self = this,
      args = arguments
    return new Promise(function(resolve, reject) {
      // 获取 generator 实例
      var gen = fn.apply(self, args)
      // 异步任务队列的执行器，即相当于 generator 函数返回值的 next 方法，每次调用 next 方法的时候就去执行下一个异步任务操作
      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'next', value)
      }
      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'throw', err)
      }
      // 启动异步任务队列
      _next(undefined)
    })
  }
}

var fetchData = function fetchData(data) {
  return new Promise(function(resolve) {
    return setTimeout(resolve, 1000, data + 1)
  })
}

var fetchValue =
  /*#__PURE__*/
  (function() {
    var _ref = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee() {
        var value1, value2, value3
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch ((_context.prev = _context.next)) {
              case 0:
                _context.next = 2
                return fetchData(1)

              case 2:
                value1 = _context.sent
                _context.next = 5
                return fetchData(value1)

              case 5:
                value2 = _context.sent
                _context.next = 8
                return fetchData(value2)

              case 8:
                value3 = _context.sent
                console.log(value3)

              case 10:
              case 'end':
                return _context.stop()
            }
          }
        }, _callee)
      })
    )

    return function fetchValue() {
      return _ref.apply(this, arguments)
    }
  })()

fetchValue()
```

我们观察下编译后的代码有几个函数需要我们关注下：`_asyncToGenerator`，`asyncGeneratorStep`这 2 个函数的说明在上面的代码当中有注释说明。这里需要注意的是代码中出现了一个`regeneratorRuntime`这样一个对象(方法)，且提供了 mark，wrap 方法 ，但是在编译后的代码当中是没有看到有关这个对象的定义的。这个其实是 facebook 提供的一个编译转化 generator 函数的库，具体可查看其[github](https://github.com/facebook/regenerator/tree/master/packages/regenerator-runtime)。这里就不深入解释这个库里面的代码细节了，这里借用羽讶大大整理出的一个简化版的`regeneratorRuntime`，我们通过这个简化版去理解下这个 workflow：

```javascript
;(function() {
  var ContinueSentinel = {}

  var mark = function(genFun) {
    // 创建一个只有 next 方法的对象实例
    var generator = Object.create({
      next: function(arg) {
        return this._invoke('next', arg)
      }
    })
    // 通过原型继承的方式去获取 next 方法
    genFun.prototype = generator
    return genFun
  }

  function wrap(innerFn, outerFn, self) {
    // 继承拥有 next 方法的对象实例
    var generator = Object.create(outerFn.prototype)

    var context = {
      done: false,
      method: 'next',
      next: 0,
      prev: 0,
      sent: undefined,
      abrupt: function(type, arg) {
        var record = {}
        record.type = type
        record.arg = arg

        return this.complete(record)
      },
      complete: function(record, afterLoc) {
        if (record.type === 'return') {
          this.rval = this.arg = record.arg
          this.method = 'return'
          this.next = 'end'
        }

        return ContinueSentinel
      },
      stop: function() {
        this.done = true
        return this.rval
      }
    }

    // 给这个对象实例添加 _invoke 方法
    generator._invoke = makeInvokeMethod(innerFn, context)

    // 返回一个 generator 实例，innerFn 作为 generator 的迭代器，传入 makeInvokeMethod 方法
    return generator
  }

  // 创建 invoke 方法，通过闭包来缓存这个 workflow 的状态标志位，当然这个状态标志位也可以放到外面作为一个局部变量，但是通过闭包的形式去实现，可以实现私用变量，这个变量也就不会受到外界代码的影响而被篡改，更加安全。
  function makeInvokeMethod(innerFn, context) {
    var self = this
    var state = 'start'

    return function invoke(method, arg) {
      if (state === 'completed') {
        return { value: undefined, done: true }
      }

      // 记录当前 workflow 进行的方法及参数 arg
      context.method = method
      context.arg = arg

      while (true) {
        state = 'executing'

        if (context.method === 'next') {
          context.sent = context._sent = context.arg // 需要传递的参数
        }

        var record = {
          type: 'normal',
          arg: innerFn.call(self, context)
        }

        if (record.type === 'normal') {
          state = context.done ? 'completed' : 'yield'

          if (record.arg === ContinueSentinel) {
            continue
          }

          return {
            value: record.arg, // 如果返回的是一个 promise，那么就需要把后面的异步任务添加到这个 promise 的 then 方法回调里面
            done: context.done
          }
        }
      }
    }
  }

  global.regeneratorRuntime = {}

  regeneratorRuntime.wrap = wrap
  regeneratorRuntime.mark = mark
})()
```

我们首先来看下`_asyncToGenerator`方法内部先执行`regeneratorRuntime.mark`方法，这个方法接收一个 _callee 方法，在`regeneratorRuntime.mark`方法内部首先创建一个具有 next 方法的的实例，并将 _callee 方法的 prototype 指向这个实例。这样通过 _callee 原型创建出来的实例也有具有了 next 方法。`regeneratorRuntime.wrap`方法接收2个参数(innerFn, outerFn)，对应到具体代码实现就是 _callee$ 和 _callee。通过代码我们可以看到，首先通过 outerFn(即 _callee)创建一个 generator 实例，并在这个 generator 实例上添加一个 _invoke 方法，这个方法是通过 makeInvokeMethod 方法接收 innerFn(即 _callee$)创建的。在整个 async 函数执行的过程中，每个 await 后面接的方法实际上都是执行的 innerFn，只是通过 makeInvokeMethod 这个方法对 innerFn 进行相关 runtime 的包装。

TODO: 

一些思考：


相关链接：https://github.com/mqyqingfeng/Blog/issues/103
