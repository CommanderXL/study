# 跨端一致性&性能优化：Mpx2RN 异步分包

## 前言

异步分包的能力建设是 Mpx2RN 在今年上半年迭代的最核心的能力之一。在首个落地业务网约车行前三合一项目当中取得了非常亮眼的性能优化数据：

* Android FCP P90由1150ms降低至590ms
* iOS FCP P90由760ms降低至490ms 
* 使用分包与异步分包功能优化后主包体积大小从3.9M降低到1.2M, 降幅达69%

同时也为 Mpx2RN 在更广泛的业务场景的落地打下了坚实的基础。

-------

对于 Mpx 跨端来说，核心思路是以微信小程序的技术规范为标准，不同端参照小程序的技术规范来补齐/抹平相关的能力实现，最终确保以 Mpx 作为上层的 DSL 跨端输出的表现一致。

对于 Mpx2RN 的异步分包能力来说也不例外：

* 由微信小程序定义异步分包的规范和标准（参见[文档](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/async.html)）；
* RN 作为宿主平台按照小程序的规范和标准提供底层的能力实现；

在进入 Mpx2RN 的异步分包能力分享之前，先简单了解下 Mpx 跨端在不同平台上能力差异与实现。

## Mpx 跨小程序异步分包

Mpx 跨小程序平台主要包括微信/阿里/头条小程序等。在小程序平台场景下是由各小程序平台自身提供异步分包的底层的能力(包的加载、执行等能力)，对于上层的小程序应用来说完全黑盒，Mpx 在跨小程序平台的场景下只需要保证最终的代码符合分包输出规范（即代码的拆包），再交由不同的宿主小程序平台去完成最终的分包代码的编译和输出来保障分包能力的加载&执行以及分包的管理。

**在 Mpx 跨小程序平台的场景下，Mpx 主要利用 Webpack 来做拆包及分包输出，实际的分包加载&执行都是由小程序平台来接管。**

## Mpx2Web 异步分包

对于 Mpx2Web 的场景来说，代码实际运行的宿主是浏览器，**浏览器本身提供了动态插入 script 标签异步加载并执行 js 代码的能力**。在 Mpx2Web 的运行时阶段，页面的渲染完全由 Vue 去接管(具体的技术细节可以参见[这篇文章](https://github.com/CommanderXL/Biu-blog/issues/56))，Vue 提供了[异步组件](https://v2.cn.vuejs.org/v2/guide/components-dynamic-async.html#%E5%BC%82%E6%AD%A5%E7%BB%84%E4%BB%B6)的能力，那么 Mpx2Web 的场景要**遵照微信小程序的规范来实现异步分包的能力**，最终也就是在编译构建阶段转为 Vue 异步组件。

**在 Mpx2Web 场景下，Mpx 除了利用 Webpack 来做拆包及分包输出，实际的分包加载由 Webpack 提供的运行时代码来完成，底层能力由浏览器提供，最终动态加载的代码执行由浏览器来接管。**

<!-- Mpx 侧来完成代码的转换，构建工具 webpack 完成拆包，运行时代码的处理。平台侧提供下包的能力。

再回到 Mpx2RN 的场景，宿主是 RN，但是它并没有提供直接可用的异步加载并执行 js 代码的能力。此外......

**因此在 Mpx2RN 场景下，Mpx 利用 Webpack 做拆包及分包输出，分包的加载由 Mpx 提供的运行时代码来完成，最终的代码执行由 RN 来接管。** -->

## RN 异步分包

RN 使用 react 作为上层 dsl，react 本身提供了 lazy + suspense 的方案去**延迟挂载组件代码**，在 web 技术体系下通过编译构建工具（如 webpack）支持 dynamic import 动态导入的能力去实现 js bundle 拆分，最终这些拆分后的代码可以通过发布到 CDN 上并按需加载，来达到减少主 bundle 体积，优化页面加载性能。

在 RN 场景当中，原生支持 lazy + suspense 以及 dynamic import 的 api，但是**经过 metro 编译构建后最终代码的产物仍然输出到同一个 bundle 当中**，最终组件可以延迟挂载，优化页面渲染的性能，但是主 bundle 体积没有太大的变化，同时也不具备 bundle 按需加载的能力，此外 RN 官方标准 API 也并不直接支持动态执行额外的 JS Bundle。那么如果想在 RN 平台上做到和 web 能力一致，那么很显然 RN 需要在构建工具，JS Runtime 以及 Native 容器上都需要额外的能力适配才能达到和 web 技术体系下能力一致的动态加载能力。

<!-- 但是回到 Mpx2RN 的场景下，情况又变的不一样了。对于 Mpx2RN 异步分包这个能力来说，包含了两层含义：

* 由微信小程序定义异步分包的规范和标准；
* RN 作为宿主平台按照小程序的规范和标准提供底层的能力实现；

最终一套以 Mpx 为上层 DSL 的代码，也就具备了在不同端上有着相同能力和表现的分包能力。



在 Mpx2RN 整个工程链路当中，涉及到了两个编译构建流程：

* mpx app => webpack => js bundle
* js bundle => metro => HBC

Mpx 的构建主要是将 mpx SFC 转化为 react component，并注入 RN 相关的运行时，最终产出可以在 RN 环境下运行的 js bundle。

对于 DRN 的构建来说，会消费第一阶段的 js bundle 来产出最终能在 DRN 容器上运行的 HBC 代码。 -->

<!-- 为什么要防到 mpx 侧来做？为什么不放到 metro 来做？
它们两者之间编译构建的区别是什么？ -->

## Mpx2RN 异步分包

在 Mpx2RN 的场景下宿主环境变成了 App 容器。如果要对等实现微信小程序的异步分包规范就需要宿主容器提供一系列的底层能力，从能力分层上来看主要包含以下两个环节：

* 上层框架支持分包代码输出；
* 容器支持分包代码的加载&执行；

在 Mpx2RN 整个工程链路当中，涉及到了两个编译构建流程：

* mpx app => webpack => js bundle
* js bundle => metro => HBC

其中第一阶段 Mpx 的构建会将 mpx SFC 转化为 react component，并注入 RN 相关的运行时代码，最终产出可以在 RN 环境下运行的 js bundle。

第二阶段对于 RN 的构建来说，会消费第一阶段的 js bundle 来产出最终能在 RN 容器上运行的 HBC 代码。

![image1](https://dpubstatic.udache.com/static/dpubimg/hEPgJLZp-SllFC5eQNZvL_process1.jpg)


![image2](https://dpubstatic.udache.com/static/dpubimg/0p5P_Wq2AT53W-OdJWAqt_process2.jpg)

所以 Mpx2RN 异步分包能力是一套跨越构建工具、JS Runtime和 Native 容器的完整解决方案 。

<!-- 在 Mpx2RN 的场景下是**以微信小程序的异步分包为规范在 RN 平台下完成同等能力的实现**，具体体现在：

* wx.onLazyLoadError
* js bundle 异步分包 - `require.async` api
* 页面/组件的异步分包能力

等。 -->


<!-- Mpx 基于 Webpack 的分包能力。 -->

<!-- react async component container，dynamic import 的桥接，所以最终页面/组件的代码最终都会变为异步执行的策略。 -->

<!-- * import 转换能力 -->
<!-- * require.async 转换能力 -> 桥接到 dynamic import 的能力 -->

<!-- 异步分包页面/组件/js chunk -->

<!-- 页面/组件可以通过 mpx 声明增强语法来实现； -->
<!-- js chunk 的实现就不一样了； -->

<!-- 如何去拆？ -->

<!-- ### 技术细节

mpx sfc -> Mpx2RN process loader(template/script/json) -> js 代码的过程（中间态的代码）建立 （App -> 页面 -> component） 之间的依赖关系

依赖关系建立 -> xx


参与分包的都有哪些要素呢？页面/组件/js module -->

<!-- ## 异步分包页面/组件

Mpx Component/Page -> AsyncSuspense -> react Component

todo 补个图 -->

### Webpack Code Splitting

Mpx 使用 Webpack 作为编译构建工具。Webpack 本身提供了高度可定制的 Code Splitting 能力，它主要体现在：

* 编译阶段 - 模块拆分与合并；
* 运行时 - 模块加载与管理；

对于开发者来说也有不同的方式来使用这部分的功能：

* 配置 optimization.splitChunk 去精细化管理分包的拆分和合并策略；
* 通过 webpack hook 直接**“侵入” webpack 内部去接管异步分包代码的加载和执行**；

通过一个简单的 js demo 来大致讲解下 Webpack 的处理流程：

```javascript
// add.js
export default function(a, b) {
  return a + b
}

// index.js 动态引入 add.js
import('./add.js').then((m) => { 
  m.default(1, 2)
})

-------
// index.js 编译后输出的代码
__webpack__require__.e(1).then(__webpack_require__.bind(__webpack_require__, 3)).then((m) => {
  // do something
})
```

index.js 源码当中 `import` api 在 js parse 阶段会被 webpack 识别到使用了 dynamic import 的能力，后续在 webpack 构建 moduleGraph 的阶段会对 index.js module 添加一个 AsyncDependenciesBlock 类型依赖，标记为异步模块。`add.js` 最终会被 Webpack 单独输出到一个 js chunk 当中，这个 js bundle 可以被单独发布到 CDN 上。当代码实际执行到 index.js 当中会通过 `__webpack_require__.e` 方法异步加载 `add.js` 并执行。

在运行时阶段为了能正常加载异步的 js bundle，在编译过程中 webpack 会按需注入和异步分包有关的  RuntimeModule（从功能定位上来说，RuntimeModule 一般是用以注入全局的运行时模块，给 `__webpack_require__` 这个函数上去挂载相关的方法，在每个 module 内部可以通过 `__webpack_require__.xx` 方法去访问到注入的对应方法），和 Code Splitting 高度相关的 RuntimeModule 主要有如下2个：

* JsonpChunkLoadingRuntimeModule

定义了 Jsonp 格式的代码加载运行机制（浏览器所支持的异步代码执行的方式）。注入到最终产物的代码会通过劫持 `chunkLoadingGlobal.push` 来管理异步 js chunk 的加载和缓存。异步分包代码也是通过 Jsonp 的格式产出。

* LoadScriptRuntimeModule

LoadScriptRuntimeModule 提供了在**浏览器环境下的异步加载 js 代码的具体实现**：DOM 当中动态插入需要异步加载 js bundle 的 `<script>` 标签：

```javascript
class LoadScriptRuntimeModule extends HelperRuntimeModule {
  ...
  generate () {
    ...
    const code = Template.asString([
      "script = document.createElement('script');",
      scriptType ? `script.type = ${JSON.stringify(scriptType)};` : '',
      charset ? "script.charset = 'utf-8';" : '',
      `script.timeout = ${loadTimeout / 1000};`,
      `if (${RuntimeGlobals.scriptNonce}) {`,
      Template.indent(
        `script.setAttribute("nonce", ${RuntimeGlobals.scriptNonce});`
      ),
      '}',
      uniqueName
        ? 'script.setAttribute("data-webpack", dataWebpackPrefix + key);'
        : '',
      `script.src = ${
        this._withCreateScriptUrl
          ? `${RuntimeGlobals.createScriptUrl}(url)`
          : 'url'
      };`,
      crossOriginLoading
        ? Template.asString([
            "if (script.src.indexOf(window.location.origin + '/') !== 0) {",
            Template.indent(
              `script.crossOrigin = ${JSON.stringify(crossOriginLoading)};`
            ),
            '}'
          ])
        : ''
    ])
    ...
  }
}
```

对于 webpack 来说，其所提供的 Code Splitting 当中的模块拆分/合并、模块的管理能力，其实现和平台无关。但是对于异步模块的加载来说，**LoadScriptRuntimeModule 所注入的代码强依赖浏览器环境才能正常运行，显然这些代码在 RN 平台下无法正常使用**。


### MpxAsyncSuspense 容器组件

在上文也提到了在小程序平台上，由平台提供底层的分包加载能力，此外还包括了模块的缓存和复用、异常处理这些逻辑层的功能外，以及兜底页面的渲染和重试这些视图能力。这些能力需要在 Mpx2RN 上有对等的实现。

在能力的分层上，Mpx 内部单独抽象了一个异步加载容器组件 `MpxAsyncSuspense` 用以管理异步分包页面/组件的：

* 异步加载状态的管理，模块的缓存和复用；
* 全局异常加载 api 的调用；
  * onLazyLoad
  * onLazyLoadPageError
* 占位页面/组件&兜底页面/组件的渲染；
  * loading；
  * fallback；
* 异步分包页面重试；
* 调度页面/组件的渲染；

对于参与到异步分包页面/组件来说，不需要关注异步加载的过程，统一交由 MpxAsyncSuspense 来管理和调度，页面/组件只需要关注自身的渲染和逻辑；

### Webpack LoadAsyncChunkRuntimeModule & RN LoadChunkAsync API

为了充分利用 Webpack Code Splitting 已有的能力，同时也想使得这一能力能在 RN 平台下能正常运行，核心要解决的问题是 webpack 所提供加载异步 chunk 的能力强依赖浏览器所提供的：

* script 标签异步加载 js chunk；
* 同一上下文当中执行 js chunk；

不过对于 RN 来说并没有直接可用的能力去实现以上两个功能。

因此，我们“侵入” webpack 内部的 SyncBail 类型 `hooks.runtimeRequirementInTree` api，将上文提到的 webpack 内置的 `LoadScriptRuntimeModule.js` 替换成适配 RN 异步分包能力的自定义 RuntimeModule `LoadAsyncChunkModule.js`：

```javascript
// 在 RN 场景下，识别到使用了 dynamic import 能力去注入 LoadAsyncChunkModule
if (isReact(this.options.mode)) {
  compilation.hooks.runtimeRequirementInTree
    .for(RuntimeGlobals.loadScript)
    .tap({
      stage: -1000,
      name: 'LoadAsyncChunk'
    }, (chunk, set) => {
      compilation.addRuntimeModule(
        chunk,
        new LoadAsyncChunkModule(this.options.rnConfig)
      )
      return true
    })
}
```

`LoadAsyncChunkRuntimeModule` 内部一方面充分利用 webpack code splitting 能力，另外一方面通过桥接 RN 容器所提供的 loadChunkAsync api 来实现异步分包的加载&执行的能力：

```javascript
// @mpxjs/webpack-plugin/lib/react/LoadAsyncChunkModule.js
class LoadAsyncChunkRuntimeModule extends HelperRuntimeModule {
  ...
  generate() {
    const { compilation } = this
    return Template.asString([
      'var inProgress = {}',
      `${loadScriptFn} = ${runtimeTemplate.basicFunction(
        'url, done, key, chunkId',
        [
          `var packageName = ${RuntimeGlobals.getChunkScriptFilename}(chunkId) || ''`,
          'packageName = packageName.split(\'/\').slice(0, -1).join(\'/\')',
          'var config = {',
          Template.indent([
            'url: url,',
            'package: packageName'
          ]),
          '}',
          'if(inProgress[url]) {',
          Template.indent([
            'inProgress[url].push(done)',
            'return'
          ]),
          '}',
          'inProgress[url] = [done]',
          'var callback = function (type, result) {',
          Template.indent([
            'var event = {',
            Template.indent([
              'type: type || \'fail\',',
              'target: {',
              Template.indent(['src: url']),
              '}'
            ]),
            '}'
          ]),
          Template.indent([
            'var doneFns = inProgress[url]',
            'clearTimeout(timeout)',
            'delete inProgress[url]',
            `doneFns && doneFns.forEach(${runtimeTemplate.returningFunction(
              'fn(event)',
              'fn'
            )})`
          ]),
          '}',
          `var timeout = setTimeout(callback.bind(null, 'timeout'), ${this.timeout})`,
          `var loadChunkAsyncFn = ${RuntimeGlobals.global}.__mpx.config.rnConfig && ${RuntimeGlobals.global}.__mpx.config.rnConfig.loadChunkAsync`,
          'try {',
          Template.indent([
            'loadChunkAsyncFn(config).then(callback).catch(callback)'
          ]),
          '} catch (e) {',
          Template.indent([
            'console.error(\'[Mpx runtime error]: please provide correct mpx.config.rnConfig.loadChunkAsync implemention!\', e)',
            'Promise.resolve().then(callback)'
          ]),
          '}'
        ]
      )}`
    ])
  }
}
```

> rnConfig 是 Mpx 框架专为 RN 环境提供的配置对象，用于定制 RN 平台特有的行为和功能。

在业务代码中通过 rnConfig 挂载和分包相关的 api 来做 js context 和容器的能力桥接：

```javascript
import mpx from '@mpxjs/core'

mpx.config.rnConfig.loadChunkAsync = function (config) {
  // 由 RN 容器提供的分包下载并执行 api
  return drnLoadChunkAsync(config.package)
}

mpx.config.rnConfig.downloadChunkAsync = function (packages) {
  if (packages && packages.length) {
    // 由 RN 容器提供的分包拉取 api
    drnDownloadChunkAsync(packages)
  }
}
```

### dynamic import

在支持异步分包能力之前，页面/组件之间都是通过 `require` 建立同步的引用关系，那么对于要参与异步分包的页面/组件来说，核心是将 mpx sfc 转成 react component 的阶段将同步的 `require` 改造为 dynamic import，确保命中 webpack code splitting：

```javascript
function getAsyncChunkName (chunkName) {
  if (chunkName && typeof chunkName !== 'boolean') {
    return `/* webpackChunkName: "${chunkName}/index" */`
  }
  return ''
}

function getAsyncSuspense(type, moduleId, componentRequest, componentName, chunkName, getFallback, getLoading) {
  return `getAsyncSuspense({
  type: ${JSON.stringify(type)},
  moduleId: ${JSON.stringify(moduleId)},
  chunkName: ${JSON.stringify(chunkName)},
  ${getFallback ? `getFallback: ${getFallback},` : ''}
  ${getLoading ? `getLoading: ${getLoading},` : ''}
  getChildren () {
    // dynamic import 拆包
    return import(${getAsyncChunkName(chunkName)}${componentRequest}).then(function (res) {
      return getComponent(res, {displayName: ${JSON.stringify(componentName)}})
    })
  }
})`
}
```

`getChildren` 方法内部通过 dynamic import api 来引入对应的异步分包页面/组件，在接下来的编译阶段由 webpack 来接管后续的分包流程。

### 异步分包页面

在小程序的技术开发规范当中有 Page 概念及所对应的 Page 行为和方法，不过在 react 当中并没有等价的 Page，对于 Mpx2RN 来说也就需要通过**react 自定义组件作为载体来模拟实现小程序规范当中的 Page 能力**。同时，和 Page 息息相关的还有路由系统，在小程序的技术规范当中提供了专门的路由 api 来供我们进行页面间的相互跳转、回退。

不管是 Page 还是路由系统的底层能力实现都由小程序平台来提供，那么在 Mpx2RN 的场景下需要有对等的实现，在这种情况下 Mpx 作为上层的 DSL，实际的渲染工作完全是被 RN 所接管，其中 `@react-navigation` 作为路由系统底层依赖：

```javascript
// @mpxjs/core/src/platform/createApp.ios.js
export default function createApp(options) {
  ...
  const Stack = createNativeStackNavigator()
  const getPageScreens  = (initialRouteName, initialParams) => {
    return Object.entries(pagesMap).map(([key, item]) => {
      ...
      const getComponent = () => {
        return item.displayName ? item : item()
      }
      if (key === initialRouteName) {
        return createElement(Stack.Screen, { // 路由页面
          name: key,
          getComponent,
          initalParams,
          layout: headerLayout
        })
      }
      return createElement(Stack.Screen, {
        name: key,
        getComponent,
        layout: headerLayout
      })
    })
  }

  ...
  global.__mpxOptionsMap[currentInject.moduleId] = memo((props) => {
    ...
    return createElement(SafeAreaProvider,
      null,
      createElement(NavigationContainer,
        {...},
        createElement(Stack.Navigator,
          {...},
          ...getPageScreens(initalRouteName, initialParams)
        )
      )
    )
  })
}
```

对于每个 Stack.Screen 组件来说会消费组件来作为路由的页面，对于非异步分包的页面，Stack.Screen 实际渲染的就是对应声明的页面组件。**对于异步分包页面来说，Stack.Screen 组件实际消费的是异步加载容器组件(AsyncSuspense)，再由异步加载容器组件去管理异步加载的页面。**

![image3](https://dpubstatic.udache.com/static/dpubimg/TnejmXNhSoQJcn_Mjpjmc_process3.jpg)

### 异步分包组件

异步分包组件的处理流程和异步分包页面类似，在编译阶段将 mpx sfc 处理为 react component 代码的过程中，原本是构建当前页面/组件和其依赖的组件的直接依赖关系。那么**对于异步分包组件来说是构建的当前页面/组件和 MpxAsyncSuspense 容器组件的依赖关系，再由 MpxAsyncSuspense 来接管异步组件的加载和渲染**；

![image4](https://dpubstatic.udache.com/static/dpubimg/De4u5UuS5EA-sKdR-mAhJ_process4.jpg)

### 异步分包 js bundle

对于分包 js bundle 来说，业务代码中使用微信小程序的 `require.async` api 来标识所依赖的 js bundle 是异步加载的。

```javascript
require.async('./add.js?root=utils').then((m) => {
  // do something
}).catch(() => {
  // catch load async chunk error
})
```

但是 `require.async` api 本身是小程序的能力规范，并不像 webpack 提供的 dynamic import 在编译阶段被识别。所以对于 `require.async` 拆分的 js bundle 主要是在 parse 阶段去模拟实现 dynamic import 的能力，使用 webpack 内置的 AsyncDependenciesBlock 和 ImportDependency 使得这个模块被 webpack 当作异步模块来处理。

这里涉及到一些 webpack 依赖构建的内容，不单独展开了，有兴趣的同学可以[参阅代码](https://github.com/didi/mpx/blob/master/packages/webpack-plugin/lib/index.js#L1440-L1499)

<!-- * 添加 AsyncDependenciesBlock -->
<!-- * 添加 ImportDependency -->

<!-- 在编译环节主要借助 Webpack Code Splitting 的能力进行拆包，在运行时环节 xxx -->

<!-- 在没有实现分包能力之前，所有的代码最终都会打成一个 js bundle，体积会大，加载时间会变长。 -->





<!-- ## RN LoadChunkAsync

RN 官方标准 API 并不直接支持动态加载并执行额外的 js bundle，这项功能强依赖宿主 App 的能力实现。

在 Mpx2RN xxx，这部分都需要 RN 容器提供底层的能力 api 以供上层应用使用。rnConfig 是 Mpx 框架专为 RN 环境提供的配置对象，用于定制 RN 平台特有的行为和功能。

```javascript
import mpx from '@mpxjs/core'

mpx.config.rnConfig.loadChunkAsync = function (config) {
  // 由 RN 容器提供的分包下载并执行 api
  return drnLoadChunkAsync(config.package)
}

mpx.config.rnConfig.downloadChunkAsync = function (packages) {
  if (packages && packages.length) {
    // 由 RN 容器提供的分包拉取 api
    drnDownloadChunkAsync(packages)
  }
}
``` -->

<!--* 非常有技术复杂度的一个项目
 * 问题分析(mpx、rn、微信平台能力设计)
  * 微信平台能力标准的解读
  * webpack 的能力
  * mpx2rn 的差异
  * react 相关的能力
  * 和容器如何交互（RN 提供了 lazy api）
  * 当前的编译构建过程（webpack -> metro）
* 技术架构设计
  * 分包策略 - 和小程序的异同（async-common 等）
  * 编译 -> mpx compile -> webpack split chunk
  * 运行时 -> webpackRuntimeModule
* mpx2rn（mpx & drn 交互）
* 一些问题（ExternalModule）
  * ExternalModule
  * RetryModule -->