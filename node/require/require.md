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

这个时候`node.js`会直接获取到你这个程序执行路径，并在这个方法当中返回

2. `require(xxx)`require一个存在于`node_modules`中的模块

这个时候会对执行路径上所有可能存在`node_modules`的路径进行遍历一遍

3. `require(./)`require一个相对路径或者绝对路径的模块

直接返回父路径

当拿到需要找寻的路径后，调用`Module._findPath`方法去查找对应的文件路径。

```javascript
Module._findPath = function (request, paths, isMain) {
  if (path.isAbsolute(request)) {
    paths = [''];
  } else if (!paths || paths.length === 0) {
    return false;
  }

  // \x00 -> null，相当于空字符串
  var cacheKey = request + '\x00' +
                (paths.length === 1 ? paths[0] : paths.join('\x00'));
  // 路径的缓存
  var entry = Module._pathCache[cacheKey];
  if (entry)
    return entry;

  var exts;
  // 尾部是否带有/
  var trailingSlash = request.length > 0 &&
                      request.charCodeAt(request.length - 1) === 47/*/*/;

  // For each path
  for (var i = 0; i < paths.length; i++) {
    // Don't search further if path doesn't exist
    const curPath = paths[i];   // 当前路径
    if (curPath && stat(curPath) < 1) continue;
    var basePath = path.resolve(curPath, request);
    var filename;

    // 调用internalModuleStat方法来判断文件类型
    var rc = stat(basePath);
    // 如果路径不以/结尾，那么可能是文件，也可能是文件夹
    if (!trailingSlash) {
      if (rc === 0) {  // File.  文件
        if (preserveSymlinks && !isMain) {
          filename = path.resolve(basePath);
        } else {
          filename = toRealPath(basePath);
        }
      } else if (rc === 1) {  // Directory. 当提供的路径是文件夹的情况下会去这个路径下找package.json中的main字段对应的模块的入口文件
        if (exts === undefined)
          // '.js' '.json' '.node' '.ms'
          exts = Object.keys(Module._extensions);
        // 获取pkg内部的main字段对应的值
        filename = tryPackage(basePath, exts, isMain);
      }

      if (!filename) {
        // try it with each of the extensions
        if (exts === undefined)
          exts = Object.keys(Module._extensions);
        filename = tryExtensions(basePath, exts, isMain); // ${basePath}.(js|json|node)等文件后缀，看是否文件存在
      }
    }

    // 如果路径以/结尾，那么就是文件夹
    if (!filename && rc === 1) {  // Directory.
      if (exts === undefined)
        exts = Object.keys(Module._extensions);
      filename = tryPackage(basePath, exts, isMain) ||
        // try it with each of the extensions at "index"
        tryExtensions(path.resolve(basePath, 'index'), exts, isMain);
    }

    if (filename) {
      // Warn once if '.' resolved outside the module dir
      if (request === '.' && i > 0) {
        if (!warned) {
          warned = true;
          process.emitWarning(
            'warning: require(\'.\') resolved outside the package ' +
            'directory. This functionality is deprecated and will be removed ' +
            'soon.',
            'DeprecationWarning', 'DEP0019');
        }
      }

      // 缓存路径
      Module._pathCache[cacheKey] = filename;
      return filename;
    }
  }
  return false;
}

function tryPackage(requestPath, exts, isMain) {
  var pkg = readPackage(requestPath); // 获取package.json当中的main字段

  if (!pkg) return false;

  var filename = path.resolve(requestPath, pkg);  // 解析路径
  return tryFile(filename, isMain) ||             // 直接判断这个文件是否存在
         tryExtensions(filename, exts, isMain) || // 判断这个分别以js,json,node等后缀结尾的文件是否存在
         tryExtensions(path.resolve(filename, 'index'), exts, isMain);  // 判断这个分别以 ${filename}/index.(js|json|node)等后缀结尾的文件是否存在
}
```

梳理下上面的查询模块时的一个策略：

