## webpack module 模块系统

在我们使用 webpack 作为我们的构建工具来进行日常的业务开发过程中，我们可以借助 babel 这样的代码编译转化工具来使用 js 新版本所实现的特性，其中 ES Module 模块标准是 ES6 当中实现的，在一些低版本的浏览器当中肯定是没法直接使用 ES Module 的。所以我们需要借助 webpack 来完成相关的模块加载、执行等相关的工作，使得我们在源码当中写的遵照 ES Module 规范的代码能在低版本的浏览器当中运行。这篇文章主要就是来介绍下 webpack 自身为了达到这样一个目的从而实现的自己的一套模块系统。

webpack 输出到 dist 目标文件夹当中的代码可以这样分为这样3种：

* webpack runtime bootstrap
* 普通的 chunk
* 通过 import 语法需要异步加载的 chunk

其中 webpack runtime bootstrap 可以单独输出成一个 chunk，也可以使之包含于一个普通的 chunk 当中，这取决于你是否配置了相关的 chunk 优化策略，具体的内容参见[webpack相关文档](https://webpack.docschina.org/configuration/optimization/#optimization-runtimechunk)

在 runtime bootstrap 当中有个核心的方法：

```javascript
/******/ 	// install a JSONP callback for chunk loading
/******/ 	function webpackJsonpCallback(data) {
/******/ 		var chunkIds = data[0];
/******/ 		var moreModules = data[1];
/******/ 		var executeModules = data[2];
/******/
/******/ 		// add "moreModules" to the modules object,
/******/ 		// then flag all "chunkIds" as loaded and fire callback
/******/ 		var moduleId, chunkId, i = 0, resolves = [];
/******/ 		for(;i < chunkIds.length; i++) {
/******/ 			chunkId = chunkIds[i];
/******/ 			if(installedChunks[chunkId]) {
/******/ 				resolves.push(installedChunks[chunkId][0]);
/******/ 			}
/******/ 			installedChunks[chunkId] = 0;
/******/ 		}
/******/ 		for(moduleId in moreModules) {
/******/ 			if(Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
/******/ 				modules[moduleId] = moreModules[moduleId];
/******/ 			}
/******/ 		}
/******/ 		if(parentJsonpFunction) parentJsonpFunction(data);
/******/
/******/ 		while(resolves.length) {
/******/ 			resolves.shift()();
/******/ 		}
/******/
/******/ 		// add entry modules from loaded chunk to deferred list
/******/ 		deferredModules.push.apply(deferredModules, executeModules || []);
/******/
/******/ 		// run deferred modules when all chunks ready
/******/ 		return checkDeferredModules();
/******/ 	};
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}

/******/ 	// This file contains only the entry chunk.
/******/ 	// The chunk loading function for additional chunks
/******/ 	__webpack_require__.e = function requireEnsure(chunkId) {
              ...
/******/ 	};  
...
/******/ 	var jsonpArray = window["webpackJsonp"] = window["webpackJsonp"] || [];
/******/ 	var oldJsonpFunction = jsonpArray.push.bind(jsonpArray);
/******/ 	jsonpArray.push = webpackJsonpCallback;
/******/ 	jsonpArray = jsonpArray.slice();
/******/ 	for(var i = 0; i < jsonpArray.length; i++) webpackJsonpCallback(jsonpArray[i]);
/******/ 	var parentJsonpFunction = oldJsonpFunction;

```

`__webpack_require__`这个方法主要的功能就是首先判断 installedModules 上是否已经缓存了传入的 moduleId 对应的 module，如果有就直接返回这个 module.exports，即对应的 module 导出的内容。如果没有缓存过，那么首先初始化话一个新的 module 对象，并获取已经加载的 modules 上对应 moudleId 的 module 并执行(即实际每个模块的执行)，传入`module`/`module.exports`/`__webpack_require__`这3个对象，这个 module 执行完之后就返回这个 module.exports 对象。

另外就是在 window 对象上定义了一个`webpackJsonp`数组对象。同时改写了这个数组的`push`方法为`webpackJsonpCallback`(这个方法的具体实现后面会讲)。

接下来我们就来看下不包含 runtime bootstrap 代码的 module 打包后是什么样的：

```javascript
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[2],{

/***/ 2:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "del", function() { return del; });

Promise.resolve(/* import() */).then(__webpack_require__.bind(null, 1)).then(function (add) {
  return add(1, 2);
});

function del(a, b) {
  return a - b;
}

/***/ })

}]);
```

可以看到的是在 chunk 的最外层调用`window["webpackJsonp"]`上的`push`（即`webpackJsonpCallback`）方法，这个方法接收了一个数组参数，其中第一项为这个 chunk 的 chunkId，第二项为这个 chunk 所包含的所有 module。在`webpackJsonpCallback`方法内部主要完成的工作就是收集 moduleId/module 之间的映射关系并缓存(这个时候这个 module 还未被执行，只有调用`__webpack_require__`方法的时候才会执行这个 module)，此外就是将在异步加载 module 时创建 promise 对象的 resolve 函数收集至一个 resolves 数组，然后一一推出并执行，即将那些异步加载的 promise 的状态进行 resolve，那么也就会执行这个 promise 通过 then 方法传入的回调函数。此外我们可以看到这个 chunk 当中只包含了一个 moduleId 为 2 的 module，这个 module 为一个匿名的函数，接受了3个参数，即上文当中提到的有关每个 module 执行时所接收的。再回到刚才的那个例子，通过`import`语法引入了其他的模块，同时使用`export`语法导出了对应的方法或者对象。那么这个 module 通过 webpack 处理后变为一个匿名函数，原本模块当中使用的`import`语法会通过`__webpack_require__`方法来引入其他模块，原模块使用的`export`语法通过`__webpack_exports__`语法来导出相关的对象或者方法。