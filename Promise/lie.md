## Lie源码解读

学习`Promise`首先应该知道`Promise`是什么？

知道了`Promise`是什么之后，那么就应该了解相关`Promise`的规范。

接下来就通过`lie.js`的源码一起去了解下如何实现`Promise`相关的规范。

首先是`Promise`的核心的构造函数的实现。

```javascript
function INTERNAL() {}

var REJECTED = ['REJECTED'];
var FULFILLED = ['FULFILLED'];
var PENDING = ['PENDING'];

var handlers = {}

function Promise (resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError('resolver must be a function');
  }
  this.state = PENDING;
  this.queue = [];
  this.outcome = void 0;
  /* istanbul ignore else */
  if (!process.browser) {
    this.handled = UNHANDLED;
  }
  if (resolver !== INTERNAL) {
    safelyResolveThenable(this, resolver);
  }
}
```

构造函数内部定义了几个`promise`实例的属性：

* state. 

`promise`的状态值.有3种：`rejected`，`fulfilled`，`pending`

* queue

`queue数组`用以保存这个`promise`被`resolve/rejected`后需要异步执行的回调

* outcome

这个`promise`实例的值

对于promise，我们一般的用法是：

```javascript
// 传入的函数当中接收2个参数,resolve/reject，都是promise内部定义的，用以改变这个promise的状态和值
const promise = new Promise((resolve, reject) => {
  // 同步或者异步的去resolve一个值
  resolve(1)
})
```

给这个`Promise`构造函数内部传入的`resolver`由内部的方法`safelyResolveThenable`去执行:

```javascript
function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  // 标志位，初始态的promise仅仅只能被resolve/reject一次
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    // reject这个promise
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    // resolve这个promise
    handlers.resolve(self, value);
  }

  // 用一个函数将resolver执行包裹一层
  function tryToUnwrap() {
    // 这个函数即由调用方传入的
    thenable(onSuccess, onError);
  }

  // 用以捕获resolver在执行过程可能抛出的错误
  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}
```

如果给`Promise`构造函数传入`callback`在执行过程中没有报错，且被`resolve`的话，那么这个时候即调用的`onSuccess`方法，这个方法内部调用了`handlers.resolve`方法。

接下来我们看下这个方法的定义：

```javascript
handlers.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return handlers.reject(self, result.value);
  }
  // 判断这个value是否是个thenable对象
  var thenable = result.value;
  
  if (thenable) {
    safelyResolveThenable(self, thenable);
  } else {
    // 将这个promise的state从 pending -> fulfilled
    self.state = FULFILLED;
    // 更改这个promise对应的值
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    // 依次执行这个promise的queue队列里面每一项的callFulfilled方法
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  // 返回这个promise对象
  return self;
}
```

再回到我们上面举的这个例子：

```javascript
const promise = new Promise(resolve => {
  resolve(1)
})
```


