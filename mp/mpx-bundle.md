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

compilation.hooks.finishModules.tap('MpxWebpackPlugin', () => {
  // 自动跟进分包配置修改 splitChunksPlugin 配置策略
  if (splitChunksPlugin) {
    let needInit = false
    Object.keys(mpx.componentsMap).forEach((packageName) => {

    })
  }
})
```


```javascript
compilation.hooks.processAssets.tap({
  name: 'MpxWebpackPlugin',
  stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONS
}, () => {
  // ...
})
```



1. 分包的 bundle.js 输出（splitChunksPlugin）

2. 分包的 js 代码如何和分包/主包 bundle 建立起关系

`compilation.hooks.processAssets.tap()` ->

`compilation.chunkGroups.forEach`

`processChunk`