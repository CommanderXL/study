## Require源码粗读

最近一直在用node.js写一些相关的工具，对于node.js的模块如何去加载，以及所遵循的模块加载规范的具体细节又是如何并不是了解。这篇文件也是看过node.js源码及部分文章总结而来：

在es2015标准以前，js并没有成熟的模块系统的规范。Node.js为了弥补这样一个缺陷，采用了CommonJS规范中所定义的[**模块规范**](http://wiki.commonjs.org/wiki/Modules/1.1.1)，它包括：

1.require

`require`是一个函数，它接收一个模块的标识符，用以引用其他模块暴露出来的`API`。

2.module context

`module context`规定了一个模块当中，存在一个require变量，它遵从上面对于这个`require`函数的定义，一个`exports`对象，模块如果需要向外暴露API，即在一个`exports`的对象上添加属性。以及一个`module object`。

3.module Identifiers

`module Identifiers`定义了`require`函数所接受的参数规则，比如说必须是小驼峰命名的字符串，可以没有文件后缀名，`.`或者`..`表明文件路径是相对路径等等。

具体关于`commonJS`中定义的`module`规范，可以参见[wiki文档](http://wiki.commonjs.org/wiki/Modules/1.1.1)

在我们的`node.js`程序当中，我们使用`require`这个**看起来是全局**(后面会解释为什么看起来是全局的)的方法去加载其他模块。

```javascript
const util = require('./util')
```

首先我们来看下关于这个方法，`node.js`内部是如何定义的：

```javascript
Module.prototype.require = function () {
  assert(path, 'missing path');
  assert(typeof path === 'string', 'path must be a string');
  // 实际上是调用Module._load方法
  return Module._load(path, this, /* isMain */ false);
}

Module._load = function (request, parent, isMain) {
  .....

  // 获取文件名
  var filename = Module._resolveFilename(request, parent, isMain);

  // _cache缓存的模块
  var cachedModule = Module._cache[filename];
  if (cachedModule) {
    updateChildren(parent, cachedModule, true);
    return cachedModule.exports;
  }

  // 如果是nativeModule模块
  if (NativeModule.nonInternalExists(filename)) {
    debug('load native module %s', request);
    return NativeModule.require(filename);
  }

  // Don't call updateChildren(), Module constructor already does.
  // 初始化一个新的module
  var module = new Module(filename, parent);

  if (isMain) {
    process.mainModule = module;
    module.id = '.';
  }

  // 加载模块前，就将这个模块缓存起来。注意node.js的模块加载系统是如何避免循环依赖的
  Module._cache[filename] = module;

  // 加载module
  tryModuleLoad(module, filename);

  // 将module.exports导出的内容返回
  return module.exports;
}
```

`Module._load`方法是一个内部的方法，主要是:

1. 根据你传入的代表模块路径的字符串来查找相应的模块路径;
2. 根据找到的模块路径来做缓存;
3. 进而去加载对应的模块。

接下来我们来看下`node.js`是如何根据传入的模块路径字符串来查找对应的模块的：

```javascript
Module._resolveFilename = function (request, parent, isMain, options) {
  if (NativeModule.nonInternalExists(request)) {
    return request;
  }

  var paths;

  if (typeof options === 'object' && options !== null &&
      Array.isArray(options.paths)) {
    ...
  } else {
    // 获取模块的大致路径 [parentDir]  | [id, [parentDir]]
    paths = Module._resolveLookupPaths(request, parent, true);
  }

  // look up the filename first, since that's the cache key.
  // node index.js
  // request = index.js
  // paths = ['/root/foo/bar/index.js', '/root/foo/bar']
  var filename = Module._findPath(request, paths, isMain);
  if (!filename) {
    var err = new Error(`Cannot find module '${request}'`);
    err.code = 'MODULE_NOT_FOUND';
    throw err;
  }
  return filename;
}
```
在这个方法内部，需要调用一个内部的方法：`Module._resolveLookupPaths`，这个方法会依据父模块的路径获取所有这个模块可能的路径：

```javascript
Module._resolveLookupPaths = function (request, parent, newReturn) {
  ...
}
```

这个方法内部有以下几种情况的处理：

1. 是启动模块，即通过`node xxx`启动的模块

这个时候`node.js`会直接获取到你这个程序执行路径，并在这个方法当中返回。

2. `require(xxx)`require一个存在于`node_modules`中的模块

3. `require(./)`require一个相对路径或者绝对路径的模块