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

在这个例子当中，是同步去`resolve`这个`promise`，那么返回的这个`promise`实例的状态便为`fulfilled`，同时`outcome`的值也被设为`1`。

将这个例子拓展一下：

```javascript
const promise = new Promise(resolve => {
  resolve(1)
})

promise.then(function onFullfilled (value) {
  console.log(value)
})
```

在实例的`then`方法上传入`一个onFullfilled`回调执行上面的代码，最后在控制台输出`1`。

接下来我们看下`Promise`原型上`then`方法的定义：

```javascript
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === FULFILLED ||
    typeof onRejected !== 'function' && this.state === REJECTED) {
    return this;
  }
  // 创建一个新的promise
  var promise = new this.constructor(INTERNAL);
  /* istanbul ignore else */
  if (!process.browser) {
    if (this.handled === UNHANDLED) {
      this.handled = null;
    }
  }

  // new Promise在内部resolve过程中如果是同步的
  if (this.state !== PENDING) {
    var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
    unwrap(promise, resolver, this.outcome);
  } else { // 异步的resolve
    // this.queue保存了对于promise
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};
```

在`then`方法内部首先创建一个新的`promise`，接下来会根据这个`promise`的状态来进行不同的处理。

1. 如果这个`promise`已经被`resolve/reject`了(即`非pending`态)，那么会调用`unwrap()`方法来执行对应的回调函数；

2. 如果这个`promise`还是处于`pending`态，那么需要实例化一个`QueueItem`，并推入到`queue`队列当中。

我们首先分析第一种情况，即调用`then`方法的时候，`promise`的状态已经被`resolve/reject`了，那么根据对应的`state`来取对应的回调函数，并调用`unwrap`函数。

```javascript
function unwrap(promise, func, value) {
  // 异步执行这个func
  immediate(function () {
    var returnValue;
    try {
      // 捕获onFulfilled函数在执行过程中的错误
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    // 不能返回自身promise
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}
```

在这个函数中，使用`immediate`方法统一的将`func`方法异步的执行(下面会解释)。并将这个`func`执行的返回值传递到下一个`promise`的处理方法当中。

因此在上面给的例子当中，因为Promise的状态是被同步resolve的，那么接下来立即调用then方法，并执行传入的onFullfilled方法。


第二种情况，如果`promise`还是处于`pending`态，这个时候不是立即执行`callback`，还是首先实例化一个`QueueItem`，并保存到这个`promise`的`queue`队列当中。

```javascript
function QueueItem(promise, onFulfilled, onRejected) {
  // 首先保存这个promise
  this.promise = promise;
  // 如果onFulfilled是一个函数
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    // 那么重新赋值callFulfilled函数
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
// 如果onFulfilled是一个函数，那么就会覆盖callFulfilled方法
// 如果onFulfilled不是一个函数，那么就会直接调用handlers.resolve去递归处理promise
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};
```

`QueueItem`构造函数接受3个参数:`promise`，`onFullfilled`，`onRejected`。

1. promise

在`then`当中新创建的promise对象

2. onFullfilled

**上一个**promise被resolve后需要调用的回调

3. onRejected

**上一个**promise被reject后需要调用的回调函数

接下来我们看下第二种情况是在什么样的情况下去执行的：

```javascript
const promise = new Promise(resolve => {
  setTimeout(() => {
    resolve(1)
  }, 3000)
})

promise.then(data => console.log(data))
```

在这个例子当中，当过了`3s`后在控制台输出`1`。在这个例子当中，因为`promise`内部是异步去`resolve`这个`promise`。在这个`promise`被`resolve`前，`promise`实例通过`then`方法向这个`promise`的`queue`队列中添加`onFullfilled`方法，这个`queue`中保存的方法会等到`promise`被`resolve`后才会被执行。当在实际的调用`resolve(1)`时，即`promise`这个时候才被`resolve`，那么便会调用`handlers.resolve`方法，并依次调用这个`promise`的`queue`队列当中保存的`onFullfilled`函数

