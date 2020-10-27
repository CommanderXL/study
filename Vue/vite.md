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

3. 获取这个文件的所有 importers，初始化 hmrBoundaries，dirtyFiles；

4. walkImportChain 收集所有的 hmrBoundaries，dirtyFiles 以及判断 hasDeadEnd（这里的 hasDeadEnd 其实就是看依赖的模块间(除了 vue 文件外，可以理解为 vue 自动部署了相关 hmr 代码)是否部署了 import.meta.hot API）；

5. 如果 hasDeadEnd 则需要进行`full-reload`级别的更新；否则还是进行模块级别的热更新；

```javascript
...
if (hasDeadEnd) {
  send({
    type: 'full-reload',
    path: publicPath
  })
  console.log(chalk.green(`[vite] `) + `page reloaded.`)
} else {
  const boundaries = [...hmrBoundaries]
  const file =
    boundaries.length === 1 ? boundaries[0] : `${boundaries.length} files`
  console.log(
    chalk.green(`[vite:hmr] `) +
      `${file} hot updated due to change in ${relativeFile}.`
  )
  send({
    type: 'multi',
    updates: boundaries.map((boundary) => {
      return {
        type: boundary.endsWith('vue') ? 'vue-reload' : 'js-update', // 如果是 vue 文件那么是 vue-reload 类型的更新，如果是 js 文件，那么是 js-update 类型的更新
        path: boundary,
        changeSrcPath: publicPath,
        timestamp
      }
    })
  })
}
...
```

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

4. 如果是 template block 的部分发生了变化，将`needRerender`标志位置为 true

5. 如果[css module](https://github.com/vitejs/vite#css-modules)发生了变化，或[css variable](https://github.com/vitejs/vite#css-pre-processors)发生了变化，或 css scope属性发生变化，那么直接 sendReload()，并退出当前的 handleVueReload 的流程；

7. 如果仅是 style 样式的内容发生了变化，那么会通过 wss 发送 `style-update` 类型的更新消息

```javascript
// only need to update styles if not reloading, since reload forces
// style updates as well.
nextStyles.forEach((_, i) => {
  if (!prevStyles[i] || !isEqualBlock(prevStyles[i], nextStyles[i])) {
    didUpdateStyle = true
    const path = `${publicPath}?type=style&index=${i}`
    send({
      type: 'style-update',
      path,
      changeSrcPath: path,
      timestamp
    })
  }
})

// stale styles always need to be removed
prevStyles.slice(nextStyles.length).forEach((_, i) => {
  didUpdateStyle = true
  send({
    type: 'style-remove',
    path: publicPath,
    id: `${styleId}-${i + nextStyles.length}`
  })
})
```

8. 此外在这个插件内部还监听了 vue sfc 当中的 custom block 的变更，来决定是否需要进行`vue-reload`的操作流程。

#### serverPluginModuleRewrite

> src/node/server/serverPluginModuleRewrite.ts

js module 路径的解析以及 module graph 依赖的生成：建立 importer 和 importee 之间的依赖关系。

```javascript
export const moduleRewritePlugin: ServerPlugin = ({
  root,
  app,
  watcher,
  resolver
}) => {
  app.use(async (ctx, next) => {
    ...
    const importer = removeUnRelatedHmrQuery(
      resolver.normalizePublicPath(ctx.url)
    )
    ctx.body = rewriteImports(
      root,
      content!,
      importer,
      resolver,
      ctx.query.t
    )
    ...
  })
}
```

1. 使用`es-module-lexer`解析代码当中被引入的模块 imports；
2. 遍历 imports，通过 importeeMap 和 importerMap 建立起 importer 和 importee 之间的相互依赖关系（module graph 也是在这个阶段生成的）；

```javascript

...
const prevImportees = importeeMap.get(importer)
const currentImportees = new Set<string>()
importeeMap.set(importer, currentImportees)
...
const importee = cleanUrl(resolved)
if (
  importee !== importer &&
  // no need to track hmr client or module dependencies
  importee !== clientPublicPath
) {
  currentImportees.add(importee)
  ensureMapEntry(importerMap, importee).add(importer)
}
...

// src/node/server/serverPluginHmr
export function ensureMapEntry(map: HMRStateMap, key: string): Set<string> {
  let entry = map.get(key)
  if (!entry) {
    entry = new Set<string>()
    map.set(key, entry)
  }
  return entry
}
```

#### client

> src/client/client.ts

被注入到浏览器当中的 hmr 运行时的代码。用以和 serverPluginHmr 生成的 wss 建立连接。同时用以接收 wss push 过来的不同类型的更新代码策略。


### 和 Webpack HMR 方案的异同

1. 依赖关系的建立：Webpack 在 browser 运行时记录，vite 在服务侧编译时记录；

2. Dirty Module Check 的流程：Webpack 在 browser 运行时进行，vite 在文件发生变更后再服务侧编译环节即进行。

3. Module 更新：Webpack 直接替换本地缓存的模块（即删除掉）。而 vite 是直接请求新的模块内容并使用新的模块。

4. Webpack 编译流程前置，vite 编译流程后置且按需编译；

5. Webpack 使用 JSONP 请求新的编译生成的模块。vite 直接使用 ESM import 动态加载发生变更的模块内容。读取 export 导出的内容。

6. vite 对于 vue 文件变更的 hmr 做了定制化的处理。