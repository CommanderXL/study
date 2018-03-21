## Lie源码解读

这篇文章是通过`lie.js`的源码一起去了解下如何实现`Promise`相关的规范。

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
// 构造函数当中接收2个参数,resolve/reject，需要注意的是这2个参数是promise内部定义的，用以改变这个promise的状态和值
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
在`safelyResolveThenable`方法中设定了一个`called`标志位，这是因为一旦一个promise的状态发生了改变，那么之后的状态不能再次被改变，举例:

```javascript
new Promise((resolve, reject) => {
  // 一旦状态发生改变，后面的reject/resolve方法不能起作用
  resolve(1)
  reject(new Error('error'))
  resolve(2)
})
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
    // 依次执行这个promise的queue队列里面每一项queueItem的callFulfilled方法
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

1. 如果这个`promise`已经被`resolve/reject`了(即`非pending`态)，那么会直接调用`unwrap()`方法来执行对应的回调函数；

2. 如果这个`promise`还是处于`pending`态，那么需要实例化一个`QueueItem`，并推入到`queue`队列当中。

我们首先分析第一种情况，即调用`then`方法的时候，`promise`的状态已经被`resolve/reject`了，那么根据对应的`state`来取对应的回调函数，并调用`unwrap`函数(后面会详细讲解这个方法)。

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

在这个函数中，使用`immediate`方法统一的将`func`方法**异步的执行**。并将这个`func`执行的返回值传递到下一个`promise`的处理方法当中。

因此在上面给的例子当中，因为`Promise`的状态是被同步`resolve`的，那么接下来立即调用`then`方法，并执行传入的`onFullfilled`方法。

第二种情况，如果`promise`还是处于`pending`态，这个时候不是立即执行`callback`，首先实例化一个`QueueItem`，并缓存到这个`promise`的`queue`队列当中，延迟执行这个`queue`当中保存的回调函数。

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

可以看到在`QueueItem`函数内部，会对`onFullfilled`和`onRejected`的参数类型做判断，只有当它们是函数的时候，才会将这个方法进行一次缓存，同时使用`otherCallFulfilled`方法覆盖原有的`callFulfilled`方法。这也是大家经常会遇到的**值穿透**的问题，举个例子：

```javascript
const promise = new Promise(resolve => {
  setTimeout(() => {
    resolve(2)
  }, 2000)
})

promise
.then(3)
.then(console.log)
```

最后在控制台打印出2，而非3。当上一个`promise`被`resolve`后，调用这个`promise`的`queue`当中缓存的`queueItem`上的`callFulfilled`方法，因为`then`方法接收的是数值类型，因此这个`queueItem`上的`callFulfilled`方法未被覆盖，因此这时所做的便是直接将这个`queueItem`中保存的`promise`进行`resolve`，同时将上一个`promise`的值传下去。可以这样理解，如果`then`方法第一个参数接收到的是个函数，那么就由这个函数处理上一个`promise`传递过来的值，如果不是函数，那么就像管道一样，先流过这个`then`方法，而将上一个值传递给下下个`then`方法接收到的函数去处理。

上面提到了关于`unwrap`这个函数，这个函数的作用就是统一的将`then`方法中接收到的`onFullfilled`参数异步的执行。主要是使用了`immediate`这个库。这里说明下为什么统一的要将`onFullfilled`方法进行异步话的处理呢。

首先，是要解决代码逻辑执行顺序的问题，首先来看一种情况：

```javascript
const promise = new Promise(resolve => {
  // 情况一：同步resolve
  resolve(1)
  // 情况二：异步resolve
  setTimeout(() => {
    resolve(2)
  }, 1000)
})

promise.then(function onFullfilled() {
  // do something
  foo()
})

bar()
```

这个`promise`可能会被同步的`resolve`，也有可能异步的`resolve`，这个时候如果`onFullfilled`方法设计成同步的执行的话，那么`foo`及`bar`的执行顺序便依赖`promise`是被**同步or异步**被`resolve`，但是如果统一将`onFullfilled`方法设计成异步的执行的话，那么`bar`方法始终在`foo`方法前执行，这样就保证了代码执行的顺序。

其次，是要解决同步回调`stackoverflow`的问题，[具体的链接请戳我](https://link.zhihu.com/?target=http%3A//blog.izs.me/post/59142742143/designing-apis-for-asynchrony)

我们看到`lie.js`的内部实现当中，每次在调用`then`方法的时候，**内部都新创建了一个`promise`的对象**并返回，这样也完成了`promise`的链式调用。即：

```javascript
const Promise = require('lie')
const promise = new Promise(resolve => setTimeout(resolve, 3000))
promise.then(() => 'a').then(() => 'b').then(() => {})
```

需要注意的是，在每个`then`方法内部创建的新的`promise`对象的`state`为`pending`态，`outcome`为`null`。可以将上面示例的`promise`打印到控制台，你会非常清晰的看到整个`promise`链的结构：

```javascript
Promise {
  state: [ 'PENDING' ],
  queue:
   [ QueueItem {
       promise: {
         state: ['PENDING'],
         queue: [
           QueueItem {
             promise: {
               state: ['PENDING'],
               queue: [
                 QueueItem {
                   promise: {
                     state: ['PENDING'],
                     queue: [],
                     outcome: undefined
                   }
                 }
               ],
               outcome: undefined,
               handled: null
             },
             onFulfilled: [Function],
             callFulfilled: [Function]
           }
         ],
        outcome: undefined,
        handled: null        
       },
       onFulfilled: [Function],
       callFulfilled: [Function] } ],
  outcome: undefined,
  handled: null }
```

实际这个`promise`链是一个嵌套的结构，一旦的最外部的`promise`的状态发生了改变，那么就会依次执行这个`promise`的`queue`队列里保存的`queueItem`的`onFulfilled`或者`onRejected`方法，并这样一直传递下去。因此这也是大家经常看到的`promise`链一旦开始，就会一直向下执行，没法在哪个`promise`的执行过程中中断。

不过刚才也提到了关于在`then`方法内部是创建的一个新的`pending`状态的`promise`，这个`promise`状态的改变完全是由上一个`promise`的状态决定的，如果上一个`promise`是被`resolve`的，那么这个`promise`同样是被`resolve`的(前提是在代码执行过程中没有报错)，并这样传递下去，同样如果上一个`promise`是被`rejected`的，那么这个状态也会一直传递下去。如果有这样一种情况，在某个`promise`封装的请求中，如果响应的错误码不符合要求，不希望这个`promise`继续被`resolve`下去，同时想要单独的`catch`住这个响应的话，那么可以在`then`方法中直接返回一个被`rejected`的`promise`。这样在这个`promise`后面的`then`方法中创建的`promise`的`state`都会被`rejected`，同时这些`promise`所接受的`fullfilled`方法不再执行，如果有传入`onRejected`方法的话便会执行`onRejected`方法，最后一直传递到的`catch`方法中添加的`onReject`方法。

```javascript
someRequest()
.then(res => {
  if (res.error === 0) {
    // do something
    return res
  } else {
    return Promise.reject(res)
  }
}).then(val => {
  // do something
}).catch(err => {
  // do something
})
```

看完`lie`的源码后，觉得`promise`设计还是挺巧妙的，`promise`事实上就是一个状态机，不过状态值能发生一次转变，由于`then`方法内部每次都是创建了一个新的`promise`，这样也完成了`promise`的链式调用，同时`then`方法中的回调统一设计为异步执行也保证了代码逻辑执行顺序。