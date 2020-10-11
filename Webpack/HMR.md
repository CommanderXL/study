## webpack hmr

相关资料：

* [Webpack HMR 原理解析](https://zhuanlan.zhihu.com/p/30669007)
* [Webpack 热更新实现原理分析](https://zhuanlan.zhihu.com/p/30623057)
* [Webpack HMR 官方文档](https://webpack.docschina.org/guides/hot-module-replacement/#-hmr)

### webpack-dev-server

在使用 webpack-dev-server 的过程中，如果指定了 hot 配置的话（使用 inline mode 的前提下）， wds 会在内部更新 webpack 的相关配置，即将 HotModuleReplacementPlugin 加入到 webpack 的 plugins 当中。

### HotModuleReplacementPlugin

在 HotModuleReplacementPlugin 执行的过程中主要是完成了以下几个工作：

1. 在 mainTemplate 上添加不同 hook 的处理回调来完成对于 webpack 在生成 bootstrap runtime 的代码阶段去注入和 hmr 相关的代码。


### HotModuleReplacement.runtime
