## Tapable 代码设计

1. Pub/Sub(高内聚，低耦合)
2. 元编程(meta programming)
3. OO的思想
4. api的设计

Tapable 整体还是基于 Pub/Sub 的设计模式来进行工作的。即你首先需要声明一个 hook，这个 hook 就相当于一个发布者，接下来你就可以在这个 hook 上去绑定你所期望的事件函数，即订阅者。一旦发布者触发这个 hook，那么所有订阅者也就会接收到对应的消息并执行。采用这种设计模式的一大特点就是高内聚，低耦合，Tapable 内部去实现了 Pub/Sub 的所有细节。使用者仅仅需要根据自己所期望的 workflow 去实例化对应的 hook 即可。

首先来看一张 Tapable 整体设计的图：


Tapable 所提供的所有的 hook 类型都是基于 Hook 这个基类进行寄生继承的。每个 hook 类型根据类型提供了 tap/tapAsync/tapPromise 这3种绑定 hook 事件的某几种。例如 SyncHook 仅仅提供了 tap 绑定方法，因为 SyncHook 是同步类型的 hook，如果你使用一个 SyncHook 去进行 tapAsync/tapPromise 绑定就会抛出错误。同样每个 hook 根据类型提供了 call/callAsync/promise 这3中触发 hook 事件的某几种。例如在 Async 异步 hooks 当中就不支持 call 方法的调用，在这些异步 hooks 实例上的 call 方法都被赋值为 undefined。

接下来我们先来看下 tap/tapAsync/tapPromise 这几种绑定 hook 事件的方法。先看个 demo:

```javascript
const { SyncHook } = require('tapable')

const syncHook = new SyncHook(['arg1', 'arg2'])

syncHook.tap('hook1', function(arg1, arg2) {
	console.log('hook1')
})

syncHook.tap('hook2', function(arg1, arg2) {
	console.log('hook2')
})

syncHook.call('a1', 'a2', () => {
	console.log('done')
})

```

`hook.tap`方法接收2个参数，第一个参数为这个 hook 类型所绑定的事件名（字符串或者是对象的形式），需要注意的是事件名必须要定义否则会报错，在 tapable 内部使用事件名作为绑定的 hook 的唯一标识。第二个参数为对应的 callback，这个 callback 所接收的参数和声明这个 hook 所传入的参数一一对应。

```javascript
const CALL_DELEGATE = function(...args) {
	this.call = this._createCall("sync"); // 重置 call 方法，那么下次再调用 hook.call 方法的时候就是被重置后的方法了
	return this.call(...args);
};
const CALL_ASYNC_DELEGATE = function(...args) {
	this.callAsync = this._createCall("async"); // 重置 callAsync 方法
	return this.callAsync(...args);
};
const PROMISE_DELEGATE = function(...args) {
	this.promise = this._createCall("promise"); // 重置 promise 方法
	return this.promise(...args);
};

class Hook {
  constructor(args = [], name = undefined) {
		this._args = args;
		this.name = name;
		this.taps = []; // 保存了所有绑定的事件
		this.interceptors = [];
		this._call = CALL_DELEGATE;
		this.call = CALL_DELEGATE;
		this._callAsync = CALL_ASYNC_DELEGATE;
		this.callAsync = CALL_ASYNC_DELEGATE;
		this._promise = PROMISE_DELEGATE;
		this.promise = PROMISE_DELEGATE;
		this._x = undefined;

		this.compile = this.compile;
		this.tap = this.tap;
		this.tapAsync = this.tapAsync;
		this.tapPromise = this.tapPromise;
  }
  
	// compile 方法必须被复写，否则会报错
	compile(options) {
		throw new Error("Abstract: should be overridden");
	}
	
	_createCall(type) {
		return this.compile({
			taps: this.taps,
			interceptors: this.interceptors,
			args: this._args,
			type: type
		});
	}

  _tap(type, options, fn) {
		if (typeof options === "string") { // 如果 tap 接收到的第一个参数为字符串，那么直接转为 object 形式
			options = {
				name: options
			};
		} else if (typeof options !== "object" || options === null) {
			throw new Error("Invalid tap options");
		}
		if (typeof options.name !== "string" || options.name === "") {
			throw new Error("Missing name for tap");
		}
		if (typeof options.context !== "undefined") {
			deprecateContext();
		}
		options = Object.assign({ type, fn }, options);
		options = this._runRegisterInterceptors(options); // 执行绑定的拦截器
		this._insert(options); // 处理这个 hook 绑定事件的位置
	}

	// 绑定事件
	tap(options, fn) {
		this._tap("sync", options, fn);
	}

	tapAsync(options, fn) {
		this._tap("async", options, fn);
	}

	tapPromise(options, fn) {
		this._tap("promise", options, fn);
  }
	
	...

  // 重置内部的调用的3个方法
	_resetCompilation() {
		this.call = this._call;
		this.callAsync = this._callAsync;
		this.promise = this._promise;
	}

  // 提供 stage / before 等接口来控制不同钩子的位置
	_insert(item) {
		this._resetCompilation();
		let before;
		if (typeof item.before === "string") {
			before = new Set([item.before]);
		} else if (Array.isArray(item.before)) {
			before = new Set(item.before);
		}
		let stage = 0;
		if (typeof item.stage === "number") {
			stage = item.stage;
		}
		let i = this.taps.length;
		while (i > 0) {
			i--;
			const x = this.taps[i];
			this.taps[i + 1] = x;
			const xStage = x.stage || 0;
			if (before) {
				if (before.has(x.name)) {
					before.delete(x.name);
					continue;
				}
				if (before.size > 0) {
					continue;
				}
			}
			if (xStage > stage) {
				continue;
			}
			i++;
			break;
		}
		this.taps[i] = item;
	}
}
```

最终经过`_insert`方法的处理，hook 所绑定的事件及其 callback 得以确认最终的顺序。需要注意的一个地方是在`_insert`方法内部，一开始就调用了一个`_resetCompilation`的方法，可以看到在 Hook 基类中对外暴露的 hook 执行api方法有 call/callAsync/promise，同时内部还分别维护了执行 hook 方法有 \_call/\_callAsync/\_promise。每次给一个 hook 添加新的 callback 的时候，都会调用`_resetCompilation`方法重置对外暴露的 hook 执行api方法。那么在调用 hook 执行api的时候，即会对所有的 callback 进行重新编译生成可执行的代码字符串（下文会讲）。

在 Hook 基类当中，所做的工作简单总结下就是：


不过需要注意的就是 Hook 基类自身并不提供 compile 的方法，这个需要不同的 hook 类型去单独的实现，否则在调用 compile 方法生成可执行的代码字符串时会报错。而编译生成可执行代码字符串的过程中就涉及到了另外一个基类 HookCodeFactory，而这个基类所做的工作就是 meta programming，构建一套新的函数运行时环境。

```javascript
class HookCodeFactory {
	constructor(config) {
		this.config = config;
		this.options = undefined;
		this._args = undefined;
	}

	
}
```