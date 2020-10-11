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

2. 在 mainTemplate 上添加不同 hook 的处理回调来完成对于 webpack 在生成 bootstrap runtime 的代码阶段去注入和 hmr 相关的代码，结果比较关键的 hook 单独拿出来说下：

```javascript
const mainTemplate = compilation.mainTemplate

mainTemplate.hooks.moduleRequire.tap(
  "HotModuleReplacementPlugin",
  (_, chunk, hash, varModuleId) => {
    return `hotCreateRequire(${varModuleId})`;
})
```

这个 hook 主要完成的工作是在生成 webpack bootstrap runtime 代码当中对加载 module 的 `require function`进行替换，变为`hotCreateRequire(${varModuleId})`的形式，这样做的目的其实就是对于 module 的加载做了一层代理，在加载 module 的过程当中建立起相关的依赖关系(需要注意的是这里的依赖关系并非是 webpack 在编译打包构建过程中的那个依赖关系，而是在 hmr 模式下代码执行阶段，一个 module 加载其他 module 时在 hotCreateRequire 内部会建立起相关的加载依赖关系，方便之后的修改代码之后进行的热更新操作)，具体这块的分析可以参见下面的章节。



### HotModuleReplacement.runtime
