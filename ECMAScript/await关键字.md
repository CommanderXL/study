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

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg)
    var value = info.value
  } catch (error) {
    reject(error)
    return
  }
  if (info.done) {
    resolve(value)
  } else {
    Promise.resolve(value).then(_next, _throw)
  }
}

function _asyncToGenerator(fn) {
  return function() {
    var self = this,
      args = arguments
    return new Promise(function(resolve, reject) {
      var gen = fn.apply(self, args)
      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'next', value)
      }
      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, 'throw', err)
      }
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

我们观察下编译后的代码有几个函数需要我们关注下


https://github.com/mqyqingfeng/Blog/issues/103
