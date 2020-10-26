1. 全流程
2. 模型/要素 进行抽象
3. Webpack 对应的实现
4. ESM 对应的实现（未来）
5. 重要的一点：如何定义更新的策略 （vue-loader）

a. 模块的发展历程
b. 页面刷新
c. 这个技术出现的背景

### 全流程

回想下目前的开发方式：

通过一个 cli 命令完成项目的初始化。

1. npm run serve （一个本地的静态文件伺服服务器server + 本地构建的服务webpack）
2. 修改代码（本地服务监听修改，给 browser 推送修改信息）
3. 页面自动刷新(局部刷新 + 全部刷新)（browser 来决定更新的策略）

在 hmr 之前，使用 liveReload 的方式去完成页面全量刷新。

而 hmr 做到局部刷新

### hmr 实现的要素

局部刷新 -> 模块级别的刷新

（模块的发展历程）

webpack 提供的最为核心的功能：打包。一个依赖就作为一个模块。

webpack 构建了一套在前端运行的模块系统。类 commonjs 的方案。

在这样一个模块化的打包工具下，hmr 才得以在前端开发中开始应用。

大体的方向就是哪个模块发生了变化就更新对应的模块即可。


1. 哪个模块发生了变化：webpack 编译构建

2. 更新

### webpack 对应的实现

1. 项目的执行流程

### 热更新模块 API 的部署

### vue 项目的热更新流程

日常开发当中 vue sfc 的形式，经由 vue-loader 的处理变成如下的字符串：

TODO: vue-loader 处理过后的图

a. template block(render function)
b. script block(export default vue component options)
c. style block(动态插 style 标签)

本地开发环境下完成，

### 基于 ESM 的开发流程

