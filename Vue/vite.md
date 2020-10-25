## Vite

### HMR

基于 esm 规范实现的 hmr 不需要单独再去实现一套模块的系统，因此在整个流程当中比较重要的一个点就是如何去实现模块之间的依赖关系，hmr 的更新也是基于模块之间的依赖关系来进行工作的。

#### serverPluginHmr

> src/node/server/serverPluginHmr.ts

1. 插件内部初始化一个 Websocket server；
2. `watcher.on('change')`绑定监听文件改动监听事件；

```javascript
watcher.on('change', file => {
  if (!(file.endsWith('.vue') || isCssRequest(file))) {
    // everything except plain .css are considered HMR dependencies.
    // plain css has its own HMR logic in ./serverPluginCss.ts.
    handleJSReload()
  }
})
```

3. hasDeadEnd 需要进行`full-reload`级别的更新；


#### serverPluginVue

> src/node/server/serverPluginVue.ts

对于请求路径为 *.vue 文件的处理插件。

1. `watcher.on('change')`绑定监听文件改动的监听事件，当 *.vue 文件发生了变化后调用`handleVueReload(file)`方法进行处理；

```javascript
watcher.on('change', file => {
  if (file.endsWith('.vue')) {
    handleVueReload(file)
  }
})
```

2. parseSFC 并和之前编译缓存的 vue sfc 进行 diff；

3. 如果 script block 的部分发生了变化，那么直接 sendReload()，script block 部分的 diff 也是优先级最高的；

```javascript
const sendReload = () => {
  send({
    type: 'vue-reload',
    path: publicPath,
    changeSrcPath: publicPath,
    timestamp
  })
  console.log(
    chalk.green(`[vite:hmr] `) +
      `${path.relative(root, filePath)} updated. (reload)`
  )
}
```

4. 如果是 template block 的部分发生了变化，将`needRerender`标志位置为 true；

#### serverPluginModuleRewrite

> src/node/server/serverPluginModuleRewrite.ts

#### client

> src/client/client.ts