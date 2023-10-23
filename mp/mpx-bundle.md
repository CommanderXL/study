## mpx-bundle 处理策略

对于 mpx 项目而言，每一个 mpx sfc 最终都会处理为 js/wxml/wxss/json 四部分的内容。

对于产出的非 js block 的文件类型而言，在 webpack 的概念当中，它们不属于 js chunk 而是 asset 静态文件，因此这些 block 的编译构建流程和 js 也有很大的不同。例如对于 wxml block 而言...

而对于 js block 而言那就是走正常的编译构建流程：babel -> parse -> processDependencies 等流程。

和原生的小程序应用不同的是：使用原生小程序开发的应用，每个页面/组件写的 js 源码实际上就是一个 chunk，app.js 实际上就相当于一个 bootstrap 启动代码。同时原生小程序提供了 js 的模块化能力，这也意味着开发者需要自行去。

对于基于 webpack 作为构建工具的 Mpx 而言，编译构建输出的目标需要满足原生小程序的代码规范，因此每个 mpx sfc 最终都会产出一个 js chunk。而在 webpack 生态当中内置了 `splitChunksPlugin` 去精细化的控制**模块的拆分和复用策略**。这也是 mpx 基于 webpack 能更好的去支持分包产物输出、异步分包等小程序特性前提。

那接下来就来看下 mpx 如何处理这部分的策略的：

第一个问题：分包的 bundle.js 输出策略；

第二个问题：主包 bundle.js 和主包/分包 js chunk 如何建立引用联系；

```javascript
// webpack-plugin/lib/index.js
const getPackageCacheGroup = packageName => {
  if (packageName === 'main') {
    return {
      // 对于独立分包模块不应用该cacheGroup
      test: (module) => {
        let isIndependent = false
        if (module.resource) {
          const { queryObj } = parseRequest(module.resource)
          isIndependent = !!queryObj.independent
        } else {
          const identifier = module.identifier()
          isIndependent = /\|independent=/.test(identifier)
        }
        return !isIndependent
      },
      name: 'bundle',
      minChunks: 2,
      chunks: 'all'
    }
  } else {
    return {
      test: (module, { chunkGraph }) => { // webpack: Controls which modules are selected by this cache group
        const chunks = chunkGraph.getModuleChunksIterable(module) // 和这个 module 产生引用关系的所有 chunk
        return chunks.size && every(chunks, chunk => { // 是否属于这个 package
          return isChunkInPackage(chunk.name, packageName)
        })
      },
      name: `${packageName}/bundle`,
      minChunks: 2,
      minSize: 1000,
      priority: 100,
      chunks: 'all'
    }
  }
}

compilation.hooks.finishModules.tap('MpxWebpackPlugin', () => {
  // 自动跟进分包配置修改 splitChunksPlugin 配置策略
  if (splitChunksPlugin) {
    let needInit = false
    // 每个 packageName 下的 components 映射关系都已经生成
    Object.keys(mpx.componentsMap).forEach((packageName) => {
      if (!hasOwn(splitChunksOptions.cacheGroups, packageName)) {
        needInit = true
        // 依据 packageName 动态添加 cacheGroups 配置信息
        splitChunksOptions.cacheGroups[packageName] = getPackageCacheGroup(packageName)
      }
    })
    // 更新 SplitChunksPlugin options 的配置
    if (needInit) {
      splitChunksPlugin.options = new SplitChunksPlugin(splitChunksOptions).options
    }
  }
})
```

todo: 可以画个图，module 和 chunk 之间的关系

chunkGroup 和 chunks 之间的关系


分包的 js 代码如何和分包/主包 bundle 建立起关系的？

```javascript
// 所有的 assets 都已经准备完成
compilation.hooks.processAssets.tap({
  name: 'MpxWebpackPlugin',
  stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONS
}, () => {
  const {
    globalObject,
    chunkLoadingGlobal
  } = compilation.outputOptions

  const chunkLoadingGlobalStr = JSON.stringify(chunkLoadingGlobal)

  const processedChunk = new Set()

  function processChunk (chunk, isRuntime, relativeChunks) {
    // ...
  }

  compilation.chunkGroups.forEach((chunkGroup) => {
    if (!chunkGroup.isInitial()) {
      return
    }

    let runtimeChunk, entryChunk
    const middleChunks = []

    const chunksLength = chunkGroup.chunks.length

    chunkGroup.chunks.forEach((chunk, index) => {
      if (index === 0) {
        runtimeChunk = chunk
      } else if (index === chunksLength - 1) {
        entryChunk = chunk
      } else {
        middleChunks.push(chunk)
      }
    })

    if (runtimeChunk) {
      processChunk(runtimeChunk, true, [])
      if (middleChunks.length) {
        middleChunks.forEach((middleChunk) => {
          processChunk(middleChunk, false, [runtimeChunk])
        })
      }
      if (entryChunk) {
        middleChunks.unshift(runtimeChunk)
        processChunk(entryChunk, false, middleChunks)
      }
    }
  })
})
```

对于每个 chunkGroup 而言，根据 splitChunkPlugin 的配置都会按需生产所需要的 chunk 内容，对于主包 `main` 而言会单独生成一个 js chunk 为 bundle.js，通过配置也可以看到一个 js module 只要被引用的次数 >= 2次，它都会被输出到 bundle.js 当中，主包当中的代码不用说，如果一个 js module 即被主包的代码引用了，也被分包的代码引用了，最终代码会输出到主包的 bundle.js 当中。

另外针对每个分包会按需生成对应分包的 bundle.js（`name: {packageName}/bundle`）代码，依据的规则也是引用次数 >= 2，且这个 js module 只在当前的分包当中被使用。

那么在这里也就出现了2种 `bundle.js`，一种是存在于主包当中的所有 js module 的集合，另外一种只在分包当中被复用的所有 js module 集合。不过对于主包的 bundle.js 而言比较特殊的是包含了整个 mpx 运行时框架的代码（当然这也是因为所有的模块基本都引用了 mpx 运行时代码，最终被输出到主包的 bundle.js 当中）。那么对于分包代码而言，要想正常的运行也必须建立起主包 bundle.js 和分包代码的关系。




在 mpx 内部是基于 json 配置来动态创建入口文件的，这个过程不同于 webpack 处理 js module 及其依赖的过程。每个页面/组件都是一个独立的入口文件，通过调用 webpack 内置的 EntryPlugin 提供的相关方法来动态创建入口加入到编译流程当中：

```javascript
const EntryPlugin = require('webpack/lib/EntryPlugin')

mpx = compilation.__mpx__ = {
  ...
  addEntry (request, name, callback) {
    const dep = EntryPlugin.createDependency(request, { name })
    compilation.addEntry(compiler.context, dep, { name }, callback)
    return dep
  }
}
```

此外在 webpack 内部实现当中，每一个 EntryPoint（可以理解为入口文件）都是一个 chunkGroup（EntryPoint 继承于 chunkGroup），这也意味着在 mpx 工程项目当中，假如有 N 个页面/组件，那么就有 N+1 个 chunkGroup（多出来的一个为 app.mpx）




1. 分包的 bundle.js 输出（splitChunksPlugin）

2. 分包的 js 代码如何和分包/主包 bundle 建立起关系

`compilation.hooks.processAssets.tap()` ->

`compilation.chunkGroups.forEach`

`processChunk`