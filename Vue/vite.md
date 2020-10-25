## Vite

### HMR

基于 esm 规范实现的 hmr 不需要单独再去实现一套模块的系统，因此在整个流程当中比较重要的一个点就是如何去实现模块之间的依赖关系，hmr 的更新也是基于模块之间的依赖关系来进行工作的。

#### serverPluginHmr

> src/node/server/serverPluginHmr.ts

1. 插件内部初始化一个 Websocket server；
2. watcher.on('change') 绑定监听文件改动监听事件；