分享的议题：

1. HMR 工作流程是怎么样的？

2. webpack 的 HMR 实现？

3. module 依赖关系是如何建立的，HMR 更新策略是怎么样的？

4. webpack(现在) / vite(未来) 实现的 HMR 有什么异同？

### 全流程

简单看下目前的开发方式：

通过一个 cli 命令完成项目的初始化。

1. npm run serve （一个本地的静态文件伺服服务器server + 本地构建的服务webpack）
2. 修改代码（本地服务监听修改，给 browser 推送修改信息）
3. 页面自动刷新(局部刷新 + 全部刷新)（browser 来决定更新的策略）

时间倒退5，6年，模块打包工具还没有大面积推广使用的时候。那个时间 gulp、grunt 等自动化构建工具，

`gulp-liveReload`、`browserSync` 

在 hmr 之前，使用 liveReload 的方式去完成页面全量刷新。

对比与 liveReload 全量刷新页面的方式来说，hmr 可以做到局部更新。但是这个局部更新的前提是：模块化。即知道到底是模块发生了变化来执行对应的更新策略。

### 前端模块化 

（模块的发展历程）

AMD/CMD/CommonJS/ESM 规范

### hmr 实现的要素

局部刷新 -> 模块级别的刷新

webpack 提供的最为核心的功能：打包。一个依赖就作为一个模块。

webpack 构建了一套在前端运行的模块系统。类 commonjs 的方案。

在这样一个模块化的打包工具下，hmr 才得以在前端开发中开始应用。

大体的方向就是哪个模块发生了变化就更新对应的模块即可。


1. 哪个模块发生了变化：webpack 编译构建

2. 更新

### webpack 模块系统

webpack 模块系统是 webpack hmr 方案的基础。即 webpack hmr 为 webpack 模块系统量身定制的。

### webpack 对应的实现

但是在我们实际的业务开发当中，hmr 离我们似近似远。

近：时时刻刻都在使用；

远：要使用这个功能开箱即用，不需要我们做其他工作；

这是因为我们使用的 framework 在使用 webpack 作为构建工具的过程中，已经帮我们实现了对应 hmr 所需要部署的接口和代码。

hmr 整套的技术方案其实包含两部分的内容：

1. 构建工具(webpack，vite/snowpack)提供 hmr 框架；

2. 接入构建工具的代码，依照 hmr 的规范部署热更新的接口；


hmr 框架所包含的内容：

1. wss / eventSource 推送服务；

  a. 和 browser 进行通讯，http 1.x req/res(or loop?)）；

  b. 但是你代码发生变更和修改后，浏览器是没有感知的，所以如果浏览器也能感知到代码发生了变更，那么就需要一个通讯的机制 -> push 主动推送编译构建信息

2. 浏览器需要部署 ws client 的代码与 wss 进行通讯；(ws client 的代码需要构建工具提供以及自动注入)

当 wss <-> ws client 建立起来后，构建服务(user code)、wss 服务、浏览器 三者之间才建立起了联系；

user code 变化 -> wss 服务 -> 浏览器；

浏览器能感知到具体是哪个文件发生了变化(webpack 使用 hash 作为通讯感知，vite 使用文件路径)。

3. 浏览器感知文件发生变更后的更新策略；

4. module dependency graph；

以上就是 hmr 框架所需要包含的几个关键的点。

但是对于用户代码来说如果想要使用 hmr 的功能，那么就需要依照 hmr 框架所定义的规范来部署 hmr 相关的接口。这部分的代码是需要用户手动写的。


热更新的接口：

1. accept

2. decline

3. dispose

----

demo + 关键流程的截图

hash 即为构建的 token

具体讲下，module 之间的依赖是如何建立的。当其中一个 module 发生了变化，那么接下来的热更新的策略是如何定义的。

### webpack hmr 实现

1. webpack 提供了打包构建的服务；

2. webpack-dev-server 提供了静态文件伺服服务器 + ws server + ws client

webpack hmr 的功能作为插件的方式被集成到 webpack 编译构建的流程当中。相关的插件为：`lib/HotModuleReplacementPlugin.js`。这个插件完成的主要的工作就是：

// TODO: hooks 
1. 修改 webpack bootstrap runtime 代码，拓展 module 上的 hmr 属性； 

snippet1:

```javascript
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
```

snippet2: 

```javascript
/******/ function __webpack_require__(moduleId) {
/******/
/******/ // Check if module is in cache
/******/ if (installedModules[moduleId]) {
  /******/ return installedModules[moduleId].exports
  /******/
} // Create a new module (and put it into the cache)
/******/ /******/ var module = (installedModules[moduleId] = {
  /******/ i: moduleId,
  /******/ l: false,
  /******/ exports: {},
  /******/ hot: hotCreateModule(moduleId),
  /******/ parents:
    ((hotCurrentParentsTemp = hotCurrentParents),
    (hotCurrentParents = []),
    hotCurrentParentsTemp),
  /******/ children: []
  /******/
}) // Execute the module function
/******/
/******/ /******/ modules[moduleId].call(
  module.exports,
  module,
  module.exports,
  hotCreateRequire(moduleId)
) // Flag the module as loaded
/******/
/******/ /******/ module.l = true // Return the exports of the module
/******/
/******/ /******/ return module.exports
/******/
} // expose the modules object (__webpack_modules__)
```


a. 提供了 module.hot 属性，用以 module 部署 hmr 相关的接口；

b. 提供了 module.children | module.parents 相关的属性，用以记录 module 之间的依赖关系；

c. 对`__webpack_require__`提供一层代理，module 之间的依赖关系就是通过这个代理方法来建立的；


// TODO: hooks
2. 将`lib/HotModuleReplace.runtime.js`代码注入到 webpack bootstrap runtime 当中，提供 hmr 的运行时代码；

a. 例如 hotCreateModule / hotCreateRequire 方法实现；

b. 提供 hot.accept / hot.decline / hot.dispose 等模块热更新的方法实现；

c. 提供 hotCheck() / hotApply()

----

### Module Dependency Graph

一个 webpack 构建打包的项目，module 作为整个项目的最小构成单元。运行时确认的 Module Dependency Graph。

### Dirty Module Check

1. Bubble up（发生变化的模块的父模块如果没有部署 module.hot.* 相关的接口，那么就继续向上找父模块的父模块）

2. Hmr boundaries（必须要有完备的 hmr boundaries，否则触发 reload 操作）


### vue 项目的热更新流程

日常开发当中 vue sfc 的形式，经由 vue-loader 的处理变成如下的字符串：

TODO: vue-loader 处理过后的图

a. template block(render function)

b. script block(export default vue component options)

c. style block(动态插 style 标签)

本地开发环境下 vue-loader 完成对于 module.hot.* 相关 api 的部署。

### 基于 ESM 的热更新

1. 模块系统使用 ESM 规范，意味着浏览器里面可以直接写 import / exports 这样的代码，而不需要进行编译。

webpack 和 vite 对于 HMR 实现的异同

1. 依赖关系的建立：Webpack 在 browser 记录，vite 在编译服务侧记录；

2. vite 对于 vue 文件的 hmr 定制化的处理（监听 *.vue 和 *.js 文件）；

3. webpack 是编译流程前置，vite 是编译流程后置。

4. webpack 使用 JSONP 请求新的编译生成的模块。vite 直接使用 ESM import 动态加载发生变更的模块内容。