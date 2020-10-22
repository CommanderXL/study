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

这个 hook 主要是在 parser 编译代码过程中遇到`module.hot.accept`的调用的时候会触发，主要的工作就是处理当前模块部署依赖模块的依赖分析，在编译阶段处理好依赖的路径替换等内容。

```javascript
parser.hooks.call
  .for("module.hot.decline")
  .tap("HotModuleReplacementPlugin")
```

这个 hook 同样是在 parser 编译代码过程中遇到`module.hot.decline`的调用的时候触发，所做的工作和上面的 hook 类似。

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

// TODO: hotCreateRequire 方法需要重点分析，这是模块之间的依赖进行热更新非常重要的地方

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

1. 提供运行时的`hotCreateRequire`方法，用以对`__webpack_require__`模块引入方法进行代理，当一个模块依赖其他模块，并将其引入的时候，会建立起宿主模块和依赖模块之间的相互依赖关系，这个依赖关系也是作为之后某个模块发生更新后，寻找与其有依赖关系的模块的凭证。

```javascript
function hotCreateRequire(moduleId) {
  var me = installedModules[moduleId];
  if (!me) return $require$;
  var fn = function(request) { // 这个是 hmr 模式下，对原来的 __webpack_require__ 引入模块的函数做的一层代理
    // 通过 depModule.parents 和 module.children 来双向建立起 module 之间的依赖关系
    if (me.hot.active) {
      if (installedModules[request]) {
        if (installedModules[request].parents.indexOf(moduleId) === -1) {
          installedModules[request].parents.push(moduleId); // 建立 module 之间的依赖关系，在被引入的 module 的 module.parents 当中添加当前这个 moduleId 
        }
      } else {
        hotCurrentParents = [moduleId];
        hotCurrentChildModule = request;
      }
      if (me.children.indexOf(request) === -1) {
        me.children.push(request); // 在当前 module 的 module.children 属性当中添加被引入的 moduleId
      }
    } else {
      console.warn(
        "[HMR] unexpected require(" +
          request +
          ") from disposed module " +
          moduleId
      );
      hotCurrentParents = [];
    }
    return $require$(request); // 引入模块
  };

  ...

  return fn
}
```

2. 提供运行时的`hotCreateModule`方法，用以给每个 module 都部署热更新相关的 api：

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

首先先讲下`hotApply`内部的执行流程：

1. 遍历`hotUpdate`需要更新的模块，找出和需要更新的模块有依赖关系的模块；

```javascript
function hotApply(options) {
  function getAffectedStuff(updateModuleId) {
    var outdatedModules = [updateModuleId]
    var outdatedDependencies = {}

    var queue = outdatedModules.slice().map(function (id) {
      return {
        chain: [id],
        id: id
      }
    })
    while (queue.length > 0) {
      var queueItem = queue.pop()
      var moduleId = queueItem.id
      var chain = queueItem.chain
      module = installedModules[moduleId] // installedModules 为在 bootstrap runtime 里面定义的已经被加载过的 module 集合，这里其实就是为了取到这个 module 自己定义部署的有关热更新的相关策略
      if (!module || module.hot._selfAccepted) continue // 如果这个 module 不存在或者只接受自更新，那么直接略过接下来的代码处理
      if (module.hot._selfDeclined) {
        return {
          type: 'self-declined',
          chain: chain,
          moduleId: moduleId
        }
      }
      if (module.hot._main) {
        return {
          type: 'unaccepted',
          chain: chain,
          moduleId: moduleId
        }
      }
      for (var i = 0; i < module.parents.length; i++) { // 遍历所有依赖这个模块的 module
        var parentId = module.parents[i]
        var parent = installedModules[parentId]
        if (!parent) continue
        if (parent.hot._declinedDependencies[moduleId]) { // 如果这个 parentModule 的 module.hot._declinedDependencies 里面设置了不受更新影响的 moduleId
          return {
            type: 'declined',
            chain: chain.concat([parentId]),
            moduleId: moduleId,
            parentId: parentId
          }
        }
        if (outdatedModules.indexOf(parentId) !== -1) continue
        if (parent.hot._acceptedDependencies[moduleId]) { // 如果这个 parentModule 的 module.hot._acceptedDependencies 里面设置了其受更新影响的 moduleId
          if (!outdatedDependencies[parentId])
            outdatedDependencies[parentId] = []
          addAllToSet(outdatedDependencies[parentId], [moduleId])
          continue
        }
        // 如果这个 parentModule 没有部署任何相关热更新的**模块间依赖的更新策略**（不算_selfAccepted 和 _selfDeclined 状态），那么需要将这个 parentModule 加入到 outdatedModules 队列里面，同时更新 queue 来进行下一轮的遍历找出所有需要进行更新的 module
        delete outdatedDependencies[parentId]
        outdatedModules.push(parentId)
        queue.push({
          chain: chain.concat([parentId]),
          id: parentId
        })
      }
    }

    return {
      type: 'accepted',
      moduleId: updateModuleId,
      outdatedModules: outdatedModules, // 本次更新当中所有过期的 modules
      outdatedDependencies: outdatedDependencies // 所有过期的依赖 modules
    }
  }

  for (var id in hotUpdate) {
    if (Object.prototype.hasOwnProperty.call(hotUpdate, id)) {
      moduleId = toModuleId(id)
      /** @type {TODO} */
      var result
      if (hotUpdate[id]) {
        result = getAffectedStuff(moduleId)
      } else {
        result = {
          type: 'disposed',
          moduleId: id
        }
      }
      /** @type {Error|false} */
      var abortError = false
      var doApply = false
      var doDispose = false
      var chainInfo = ''
      if (result.chain) {
        chainInfo = '\nUpdate propagation: ' + result.chain.join(' -> ')
      }
      switch (result.type) {
        case 'self-declined':
          if (options.onDeclined) options.onDeclined(result)
          if (!options.ignoreDeclined)
            abortError = new Error(
              'Aborted because of self decline: ' +
                result.moduleId +
                chainInfo
            )
          break
        case 'declined':
          if (options.onDeclined) options.onDeclined(result)
          if (!options.ignoreDeclined)
            abortError = new Error(
              'Aborted because of declined dependency: ' +
                result.moduleId +
                ' in ' +
                result.parentId +
                chainInfo
            )
          break
        case 'unaccepted':
          if (options.onUnaccepted) options.onUnaccepted(result)
          if (!options.ignoreUnaccepted)
            abortError = new Error(
              'Aborted because ' + moduleId + ' is not accepted' + chainInfo
            )
          break
        case 'accepted':
          if (options.onAccepted) options.onAccepted(result)
          doApply = true
          break
        case 'disposed':
          if (options.onDisposed) options.onDisposed(result)
          doDispose = true
          break
        default:
          throw new Error('Unexception type ' + result.type)
      }
      if (abortError) {
        hotSetStatus('abort')
        return Promise.reject(abortError)
      }
      if (doApply) {
        appliedUpdate[moduleId] = hotUpdate[moduleId] // 需要更新的模块
        addAllToSet(outdatedModules, result.outdatedModules) // 使用单独一个 outdatedModules 数组变量存放所有过期需要更新的 moduleId，其中 result.outdatedModules 是通过 getAffectedStuff 方法找到的当前遍历的 module 所依赖的过期的需要更新的模块
        for (moduleId in result.outdatedDependencies) { // 使用单独的 outdatedDependencies 集合去存放相关依赖更新模块
          if (
            Object.prototype.hasOwnProperty.call(
              result.outdatedDependencies,
              moduleId
            )
          ) {
            if (!outdatedDependencies[moduleId])
              outdatedDependencies[moduleId] = []
            addAllToSet(
              outdatedDependencies[moduleId],
              result.outdatedDependencies[moduleId]
            )
          }
        }
      }
      if (doDispose) {
        addAllToSet(outdatedModules, [result.moduleId])
        appliedUpdate[moduleId] = warnUnexpectedRequire
      }
    }

    // Store self accepted outdated modules to require them later by the module system
    // 在所有 outdatedModules 里面找到部署了 module.hot._selfAccepted 属性的模块。(部署了这个属性的模块会通过 webpack 的模块系统重新加载一次这个模块的新的内容来完成热更新)
    var outdatedSelfAcceptedModules = []
    for (i = 0; i < outdatedModules.length; i++) {
      moduleId = outdatedModules[i]
      if (
        installedModules[moduleId] &&
        installedModules[moduleId].hot._selfAccepted
      )
        outdatedSelfAcceptedModules.push({
          module: moduleId,
          errorHandler: installedModules[moduleId].hot._selfAccepted
        })
    }

    // dispose phase TODO: 各个热更新阶段 hooks?

    var idx
    var queue = outdatedModules.slice()
    while (queue.length > 0) {
      moduleId = queue.pop()
      module = installedModules[moduleId]
      if (!module) continue

      var data = {}

      // Call dispose handlers
      var disposeHandlers = module.hot._disposeHandlers
      for (j = 0; j < disposeHandlers.length; j++) {
        cb = disposeHandlers[j]
        cb(data)
      }
      hotCurrentModuleData[moduleId] = data

      // disable module (this disables requires from this module)
      module.hot.active = false

      // 从 installedModules 集合当中剔除掉过期的 module，即其他 module 引入这个被剔除掉的 module 的时候，其实是会重新执行这个 module，这也是为什么要从 installedModules 上剔除这个需要被更新的模块的原因
      // remove module from cache
      delete installedModules[moduleId]

      // when disposing there is no need to call dispose handler
      delete outdatedDependencies[moduleId]

      // 将这个 module 所依赖的模块(module.children)当中剔除掉 module.children.parentModule，即解除模块之间的依赖关系
      // remove "parents" references from all children
      for (j = 0; j < module.children.length; j++) {
        var child = installedModules[module.children[j]]
        if (!child) continue
        idx = child.parents.indexOf(moduleId)
        if (idx >= 0) {
          child.parents.splice(idx, 1)
        }
      }
    }

    // 这里同样是通过遍历 outdatedDependencies 里面需要更新的模块，需要注意的是 outdateDependencies 里面的 key 为被依赖的 module，这个 key 所对应的 value 数组里面存放的是发生了更新的 module。所以这是需要解除被依赖的 module 和这些发生更新了的 module 之间的引用依赖关系。
    // remove outdated dependency from module children
    var dependency
    var moduleOutdatedDependencies
    for (moduleId in outdatedDependencies) {
      if (
        Object.prototype.hasOwnProperty.call(outdatedDependencies, moduleId)
      ) {
        module = installedModules[moduleId]
        if (module) {
          moduleOutdatedDependencies = outdatedDependencies[moduleId]
          for (j = 0; j < moduleOutdatedDependencies.length; j++) {
            dependency = moduleOutdatedDependencies[j]
            idx = module.children.indexOf(dependency)
            if (idx >= 0) module.children.splice(idx, 1)
          }
        }
      }
    }

    // Not in "apply" phase
    hotSetStatus('apply')

    // 更新当前的热更新 hash 值（即通过 get 请求获取 server 下发的 hash 值）
    hotCurrentHash = hotUpdateNewHash

    // 遍历 appliedUpdate 发生更新的 module
    // insert new code
    for (moduleId in appliedUpdate) {
      if (Object.prototype.hasOwnProperty.call(appliedUpdate, moduleId)) {
        modules[moduleId] = appliedUpdate[moduleId] // HIGHLIGHT: 这里的 modules 变量为 bootstrap 代码里面接收到的所有的 modules 的集合，即在这里完成新老 module 的替换
      }
    }

    // 执行那些在 module.hot.accept 上部署了依赖模块发生更新后的回调函数
    // call accept handlers
    var error = null
    for (moduleId in outdatedDependencies) {
      if (
        Object.prototype.hasOwnProperty.call(outdatedDependencies, moduleId)
      ) {
        module = installedModules[moduleId]
        if (module) {
          moduleOutdatedDependencies = outdatedDependencies[moduleId]
          var callbacks = []
          for (i = 0; i < moduleOutdatedDependencies.length; i++) {
            dependency = moduleOutdatedDependencies[i]
            cb = module.hot._acceptedDependencies[dependency]
            if (cb) {
              if (callbacks.indexOf(cb) !== -1) continue
              callbacks.push(cb)
            }
          }
          for (i = 0; i < callbacks.length; i++) {
            cb = callbacks[i]
            try {
              cb(moduleOutdatedDependencies)
            } catch (err) {
              ...
            }
          }
        }
      }
    }

    // 重新加载那些部署了 module.hot._selfAccepted 为 true 的 module，即这个 module 会被重新加载并执行一次，这样也就在 installedModules 上缓存了这个新的 module
    // Load self accepted modules
    for (i = 0; i < outdatedSelfAcceptedModules.length; i++) {
      var item = outdatedSelfAcceptedModules[i]
      moduleId = item.module
      hotCurrentParents = [moduleId]
      try {
        $require$(moduleId) // $require$ 会在被最终渲染到 bootstrap runtime 当中被替换为 webpack require 加载模块的方法
      } catch (err) {
        if (typeof item.errorHandler === 'function') {
          try {
            item.errorHandler(err)
          } catch (err2) {
            ...
          }
        } else {
          ...
        }
      }

    hotSetStatus('idle')
      return new Promise(function (resolve) {
        resolve(outdatedModules)
      })
    }
  }
}
```

所以当一个模块发生变化后，依赖这个模块的 parentModule 有如下几种热更新执行的策略：

```javascript
module.hot.accept()
```

当依赖的模块发生更新后，这个模块需要通过**重新加载**去完成本模块的全量更新。

```javascript
module.hot.accept(['xxx'], callback)
```

当依赖的模块且为 `xxx` 模块发生更新后，这个模块会执行 callback 来完成相关的更新的动作。而不需要通过**重新加载**的方式去完成更新。

```javascript
module.hot.decline()
```

这个模块不管其依赖的模块是否发生了变化。这个模块都不会发生更新。

```javascript
module.hot.decline(['xxx'])
```

当依赖的模块为`xxx`发生更新的情况下，这个模块不会发生更新。当依赖的其他模块（除了`xxx`模块外）发生更新的话，那么最终还是会将本模块从缓存中删除。

这些热更新的 api 也是需要用户自己在代码当中进行部署的。就拿平时我们使用的 vue 来说，在本地开发阶段, vue sfc 经过 vue-loader 的编译处理后，会自动帮我们在组件代码当中当中注入和热更新相关的代码。

```javascript
// vue-loader/lib/codegen/hotReload.js
const hotReloadAPIPath = JSON.stringify(require.resolve('vue-hot-reload-api'))

const genTemplateHotReloadCode = (id, request) => {
  return `
    module.hot.accept(${request}, function () {
      api.rerender('${id}', {
        render: render,
        staticRenderFns: staticRenderFns
      })
    })
  `.trim()
}

exports.genHotReloadCode = (id, functional, templateRequest) => {
  return `
/* hot reload */
if (module.hot) {
  var api = require(${hotReloadAPIPath})
  api.install(require('vue'))
  if (api.compatible) { // 判断使用的 vue 的版本是否支持热更新
    module.hot.accept()
    if (!api.isRecorded('${id}')) {
      api.createRecord('${id}', component.options)
    } else {
      api.${functional ? 'rerender' : 'reload'}('${id}', component.options)
    }
    ${templateRequest ? genTemplateHotReloadCode(id, templateRequest) : ''}
  }
}
  `.trim()
}
```

`vue-loader`通过 genHotReloadCode 方法在处理 vue sfc 代码的时候完成热更新 api 的部署功能。这里大致讲下 vue component 进行热更新的流程：

1. 当这个 vue component 被初次加载的时候，首先执行 module.hot.accept() 方法完成热更新接口的部署（上文也将到了这个接口执行的策略是会重新加载这个 vue component 来完成热更新）；
2. 如果这个 vue component 是被初次加载的话，那么会通过 api.createRecord 方法在全局缓存这个组件的 options 配置，如果这个 vue component 不是被初次加载的话（即全局缓存了这个组件的 options 配置），那么就直接调用 api.reload(rerender) 方法来进行组件的重新渲染；
3. 如果这个 vue component 提供了 template 模板的话，也会部署模板的热更新代码；
4. 当这个 vue component 的依赖发生了变化，且这些依赖都部署了热更新的代码(如果没有部署热更新的代码的话，可能会直接刷新页面)，那么这个 vue component 会被重新加载一次。对应的会重新进行前面的1，2，3流程。