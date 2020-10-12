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


2. 在 mainTemplate 上添加不同 hook 的处理回调来完成对于 webpack 在生成 bootstrap runtime 的代码阶段去注入和 hmr 相关的代码，有几个比较关键的 hook 单独拿出来说下：

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

1. 新增了 module 上的 `hot: hotCreateModule(${varModuleId})` 配置。这个 hot api 即对应这个 module 有关热更新的 api。所有有关热更新相关的接口都通过`module.hot.*`去访问。
2. 新增 parents 属性配置：初始化有关这个 module 在 hmr 下，它的 parents（这个 module 被其他 module 依赖）；
3. 新增 children 属性配置：初始化有关这个 module 在 hmr 下，它的 children（这个 module 所依赖的 module）

### HotModuleReplacement.runtime
