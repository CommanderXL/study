## webpack hmr

相关资料：

* [Webpack HMR 原理解析](https://zhuanlan.zhihu.com/p/30669007)
* [Webpack 热更新实现原理分析](https://zhuanlan.zhihu.com/p/30623057)
* [Webpack HMR 官方文档](https://webpack.docschina.org/guides/hot-module-replacement/#-hmr)

### webpack-dev-server

在使用 webpack-dev-server 的过程中，如果指定了 hot 配置的话（使用 inline mode 的前提下）， wds 会在内部更新 webpack 的相关配置，即将 HotModuleReplacementPlugin 加入到 webpack 的 plugins 当中。

### HotModuleReplacementPlugin

在 HotModuleReplacementPlugin 执行的过程中主要是完成了以下几个工作：

1. 在创建 normalModule 的阶段添加 parser 的 hook，即在之后的 module 编译解析阶段 parser 处理不同的语法时可以交由在这个阶段添加的 hook 回调来进行相关的处理。

```javascript
normalModuleFactory.hooks.parser
  .for("javascript/auto")
  .tap("HotModuleReplacementPlugin", addParserPlugins);

normalModuleFactory.hooks.parser
  .for("javascript/dynamic")
  .tap("HotModuleReplacementPlugin", addParserPlugins);
```

其中在 addParserPlugins 方法当中添加了具体有关 parser hook 的回调，有几个比较关键的 hook 单独拿出来说下：

```javascript
parser.hooks.call
  .for("module.hot.accept")
  .tap("HotModuleReplacementPlugin")
```

```javascript
parser.hooks.call
  .for("module.hot.decline")
  .tap("HotModuleReplacementPlugin")
```


2. 在 mainTemplate 上添加不同 hook 的处理回调来完成对于 webpack 在生成 bootstrap runtime 的代码阶段去注入和 hmr 相关的运行时代码，有几个比较关键的 hook 单独拿出来说下：

```javascript
const mainTemplate = compilation.mainTemplate

mainTemplate.hooks.moduleRequire.tap(
  "HotModuleReplacementPlugin",
  (_, chunk, hash, varModuleId) => {
    return `hotCreateRequire(${varModuleId})`;
})
```

这个 hook 主要完成的工作是在生成 webpack bootstrap runtime 代码当中对加载 module 的 `require function`进行替换，变为`hotCreateRequire(${varModuleId})`的形式，这样做的目的其实就是对于 module 的加载做了一层代理，在加载 module 的过程当中建立起相关的依赖关系(需要注意的是这里的依赖关系并非是 webpack 在编译打包构建过程中的那个依赖关系，而是在 hmr 模式下代码执行阶段，一个 module 加载其他 module 时在 hotCreateRequire 内部会建立起相关的加载依赖关系，方便之后的修改代码之后进行的热更新操作)，具体这块的分析可以参见下面的章节。

```javascript
mainTemplate.hooks.bootstrap.tap(
  "HotModuleReplacementPlugin",
  (source, chunk, hash) => {
    // 在生成 runtime 最终的代码前先通过 hooks.hotBootstrap 钩子生成相关的 hmr 代码然后再完成代码的拼接
    source = mainTemplate.hooks.hotBootstrap.call(source, chunk, hash);
    return Template.asString([
      source,
      "",
      hotInitCode
        .replace(/\$require\$/g, mainTemplate.requireFn)
        .replace(/\$hash\$/g, JSON.stringify(hash))
        .replace(/\$requestTimeout\$/g, requestTimeout)
        .replace(
          /\/\*foreachInstalledChunks\*\//g, // 通过一系列的占位字符串，在生成代码的阶段完成代码的替换工作
          needChunkLoadingCode(chunk)
            ? "for(var chunkId in installedChunks)"
            : `var chunkId = ${JSON.stringify(chunk.id)};`
        )
    ]);
  }
)
```

在这个 hooks.bootstrap 当中所做的工作是在 mainTemplate 渲染 bootstrap runtime 的代码的过程中，对于`hotInitCode`代码进行字符串的匹配和替换工作。`hotInitCode`这部分的代码其实就是下面章节所要讲的`HotModuleReplacement.runtime`向 bootstrap runtime 代码里面注入的 hmr 运行时代码。


```javascript
mainTemplate.hooks.moduleObj.tap(
  "HotModuleReplacementPlugin",
  (source, chunk, hash, varModuleId) => {
    return Template.asString([
      `${source},`,
      `hot: hotCreateModule(${varModuleId}),`, // 这部分的内容即这个 hook 对相关内容的拓展
      "parents: (hotCurrentParentsTemp = hotCurrentParents, hotCurrentParents = [], hotCurrentParentsTemp),",
      "children: []"
    ]);
  }
)
```

在这个 hooks.moduleObj 当中所做的工作是对`__webpack_require__`这个函数体内部的 installedModules 缓存模块变量进行拓展。几个非常关键的点就是：

1. 新增了 module 上的 `hot: hotCreateModule(${varModuleId})` 配置。这个 module.hot api 即对应这个 module 有关热更新的 api，可以看到这个部署 hot api 的工作是由 hotCreateModule 这个方法来完成的（这个方法是由 hmr runtime 代码提供的，下面的章节会讲）。最终和这个 module 所有有关热更新相关的接口都通过`module.hot.*`去访问。
2. 新增 parents 属性配置：初始化有关这个 module 在 hmr 下，它的 parents（这个 module 被其他 module 依赖）；
3. 新增 children 属性配置：初始化有关这个 module 在 hmr 下，它的 children（这个 module 所依赖的 module）

### HotModuleReplacement.runtime

Webpack 内部提供了 HotModuleReplacement.runtime 即**热更新运行时**部分的代码。这部分的代码并不是通过通过添加 webpack.entry 入口文件的方式来注入这部分的代码，而是通过 mainTemplate 在渲染 boostrap runtime 代码的阶段完成代码的注入工作的（对应上面的 mainTemplate.hooks.boostrap 所做的工作）。

在这部分热更新运行时的代码当中所做的工作主要包含了以下几个点：

```javascript
function hotCreateModule(moduleId) {
  var hot = {
    // private stuff
    _acceptedDependencies: {},
    _declinedDependencies: {},
    _selfAccepted: false, 
    _selfDeclined: false,
    _disposeHandlers: [],
    _main: hotCurrentChildModule !== moduleId,

    // Module API
    active: true,
    accept: function(dep, callback) {
      if (dep === undefined) hot._selfAccepted = true; // 表示这个 module 可以进行 hmr
      else if (typeof dep === "function") hot._selfAccepted = dep;
      else if (typeof dep === "object") // 和其他 module 建立起热更新之间的关系
        for (var i = 0; i < dep.length; i++)
          hot._acceptedDependencies[dep[i]] = callback || function() {}; 
      else hot._acceptedDependencies[dep] = callback || function() {};
    },
    decline: function(dep) {
      if (dep === undefined) hot._selfDeclined = true; // 当前 module 不需要进行热更新
      else if (typeof dep === "object") // 当其依赖的 module 发生更新后，并不会触发这个 module 的热更新
        for (var i = 0; i < dep.length; i++)
          hot._declinedDependencies[dep[i]] = true;
      else hot._declinedDependencies[dep] = true;
    },
    dispose: function(callback) {
      hot._disposeHandlers.push(callback);
    },
    addDisposeHandler: function(callback) {
      hot._disposeHandlers.push(callback);
    },
    removeDisposeHandler: function(callback) {
      var idx = hot._disposeHandlers.indexOf(callback);
      if (idx >= 0) hot._disposeHandlers.splice(idx, 1);
    },

    // Management API
    check: hotCheck,
    apply: hotApply,
    status: function(l) {
      if (!l) return hotStatus;
      hotStatusHandlers.push(l);
    },
    addStatusHandler: function(l) {
      hotStatusHandlers.push(l);
    },
    removeStatusHandler: function(l) {
      var idx = hotStatusHandlers.indexOf(l);
      if (idx >= 0) hotStatusHandlers.splice(idx, 1);
    },

    //inherit from previous dispose call
    data: hotCurrentModuleData[moduleId]
  };
  hotCurrentChildModule = undefined;
  return hot;
}
```

在 hotCreateModule 方法当中完成 module.hot.* 和热更新相关接口的定义。这些 api 也是暴露给用户部署热更新代码的接口。

其中`hot.accept`和`hot.decline`方法主要是用户来定义发生热更新的模块及其依赖是否需要热更新的相关策略。例如`hot.accept`方法用来决定当前模块所依赖的哪些模块发生更新的话，自身也需要完成一些更新相关的动作。而`hot.decline`方法用来决定当前模块依赖的模块发生更新后，来决定自身是否需要进行更新。

而`hot.check`和`hot.apply`两个方法其实是 webpack 内部使用的2个方法，其中`hot.check`方法：首先调用`hotDownloadManifest`方法，通过发送一个 Get 请求去 server 获取本次发生变更的相关内容。// TODO: 相关内容的具体格式和字段？

```javascript
{
  c: { // 发生更新的 chunk 集合
    app: true
  },
  h: 'xxxxx' // 服务端本次生成的编译hash值，用来作为下次浏览器获取发生变更的 hash 值（相当于服务端下发的一个 token，浏览器拿着这个 token 去后端获取对应的内容）
}
```

```javascript
function hotCheck(apply) {
  if (hotStatus !== "idle") {
    throw new Error("check() is only allowed in idle status");
  }
  hotApplyOnUpdate = apply;
  hotSetStatus("check"); // 更新 热更新 流程的内部状态
  return hotDownloadManifest(hotRequestTimeout).then(function(update) {
    if (!update) {
      hotSetStatus("idle");
      return null;
    }
    hotRequestedFilesMap = {};
    hotWaitingFilesMap = {};
    hotAvailableFilesMap = update.c; // 发生更新的 chunk 集合
    hotUpdateNewHash = update.h; // server 下发的本次生成的编译 hash 值，作为下次浏览器获取发生变更的 hash 值

    hotSetStatus("prepare");
    var promise = new Promise(function(resolve, reject) {
      hotDeferred = {
        resolve: resolve,
        reject: reject
      };
    });
    hotUpdate = {};
    /*foreachInstalledChunks*/  // 这段注释在渲染 bootstrap runtime 部分的代码的时候会通过字符串匹配给替换掉，最终替换后的代码执行就是对已经下载的 chunk 进行循环 hotEnsureUpdateChunk(chunkId)
    // eslint-disable-next-line no-lone-blocks
    {
      /*globals chunkId */
      hotEnsureUpdateChunk(chunkId); // hotEnsureUpdateChunk(lib/web/JsonpMainTemplate.runtime.js) 方法内部其实就是通过创建 script 标签，然后传入到文档当中完成发生更新的 chunk 的下载
    }
    if (
      hotStatus === "prepare" &&
      hotChunksLoading === 0 &&
      hotWaitingFiles === 0
    ) {
      hotUpdateDownloaded();
    }
    return promise;
  });
}
```

// TODO: 补一个 hot.check 执行的流程图
总结下`hot.check`方法执行的流程其实就是：

1. 通过 hotDownloadMainfest 方法发送一个 Get 方式的 ajax 请求用以获取发生更新的 chunk 集合以及本次编译生成的 hash；
2. 遍历已经安装完成的所有 chunk，找出需要发生更新的 chunk 名，调用 hotEnsureUpdateChunk 方法通过 jsonp 的方式完成发生更新的 chunk 下载。

接下来看下被下载的更新的 chunk 具体内容：

```javascript
webpackHotUpdate('app', {
  'compiled/module1/path': (function() {
    eval('...script...')
  }),
  'compiled/module2/path': (function() {
    eval('...script...')
  })
})
```

可以看到的是返回的 chunk 内容是可以立即执行的函数：

```javascript
function hotAddUpdateChunk(chunkId, moreModules) {
  if (!hotAvailableFilesMap[chunkId] || !hotRequestedFilesMap[chunkId])
    return;
  hotRequestedFilesMap[chunkId] = false;
  for (var moduleId in moreModules) {
    if (Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
      hotUpdate[moduleId] = moreModules[moduleId];
    }
  }
  if (--hotWaitingFiles === 0 && hotChunksLoading === 0) {
    hotUpdateDownloaded();
  }
}
```

对应所做的工作就是将需要更新的模块缓存至`hotUpdate`上，同时判断需要更新的 chunk 是否已经下载完了，如果全部下载完成那么执行`hotUpdateDownloaded`方法，其内部实际就是调用`hotApply`进行接下来进行细粒度的模块更新和替换的工作。