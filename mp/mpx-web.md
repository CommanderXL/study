## Mpx 跨 web 方案的实现

整体上的实现思路是基于小程序的开发规范然后再做跨 web 的兼容。因为 mpx 也是采用 sfc 方式去组织文件内容（包括template/script/style/json），底层框架是基于 vue。

### 编译环节：

在编译环节需要解决的一个核心问题就是 mpx sfc 如何转化为 vue sfc，在这一层处理完之后，后面的编译构建流程即可直接复用 vue-loader（即 vue 项目的编译构建）的构建流程。

本地编译启动后，mpx 文件首先会经过 mpx loader 的处理，只不过在 mpx loader 内部针对 web 环境下的编译工作做了一些特殊处理：

```javascript
module.exports = function (content) {
  ...
  if (mode === 'web') {
    if (ctorType === 'app' && !queryObj.isApp) {
      const request = addQuery(this.resource, { isApp: true })
      output += `
        import App from ${stringifyRequest(request)}
        import Vue from 'vue'
        new Vue({
          el: '#app',
          render: function(h) {
            return h(App)
          }
        })
      `
      this.loaderIndex = -1
      return callback(null, output)
    }

    return async.waterfall(
      [
        () => {...}, // processTemplate
        () => {...}, // processStyle
        () => {...}, // processJson
        ([templateRes, styleRes, jsonRes], callback) => {

        }
    )]
  }
}
```

processTemplate | processStyle | processJson -> processScript

对于项目的入口文件，注入 vue 以及项目的初始化渲染代码

对于非入口文件，例如通过 createPage 或者 createComponent 创建的页面/组件(在 vue 里面是没有 page 概念的，一切都是组件)，便需要处理 template/script/style/json 这些 block 的内容，特别是 json 配置只是在小程序里面独有的（主要是申明一些组件的依赖路径或者其他的配置），这也是和 vue sfc 里面差异非常大的点(vue sfc 里面组件依赖的申明是在 components 字段里面申明的)，所以 mpx sfc 转为 vue sfc 这个点来说，需要在编译环节处理为满足 vue sfc 文件开发规范的内容。

对于 template 来说，需要解决的3个重要的问题：

1. 基于小程序语法规范写的 template 标签语法如何和 web 拉齐；
2. 小程序的指令如何和 vue directive 拉齐；
3. 事件处理；

其中第一个点，在小程序开发规范当中，每一个标签元素其实都是一个内置组件，小程序对这些内置组件做了一定程度的封装，内置组件有自己的功能特性、样式规则、事件绑定等等，我们平时开发组件都是基于这些内置组件来进行开发的。在做 web 开发一样，浏览器提供了 `div`、`input`、`button` 等这些内置组件，只不过封装程度，提供的功能特性没有小程序提供的那么多。那么如果要做跨 web 的输出的话，最终的目标肯定是小程序和 web 渲染都是一致的，也就是在小程序使用一个内置的 button 组件，在 web 侧需要对应的实现其功能。因此在标签语法的处理流程中是通过收集&标记 template 当中使用到了哪些内置基础组件（内置组件都是全局的），渲染阶段其实是将渲染这些内置组件所对应在 vue 侧实现的自定义组件。最终达到的效果就是在小程序渲染的基础组件和 web 侧渲染出来的都是一致的。

对于第二个点，小程序对于模板语法做了一定程度的增强，提供了一些可以提高开发效率&体验的 directive，例如条件渲染(wx:if)，列表渲染等(wx:for)，而在 vue 当中不仅仅提供了条件渲染、列表渲染还有一些对于 class，style，show 等非常好用的一些指令。所以在这部分的处理过程当中，首先是对于2个平台上已有指令的对齐（wx:if -> v-if），另外一个点就是对于小程序的指令系统做增强，即在小程序的规范生态下通过编译 + runtime 配合来达到实现小程序没有但是 vue 里面有的功能。所以在使用 mpx 进行小程序开发的过程中，可以使用一些原生小程序没有提供的增强型的指令。

对于第三点事件处理，mpx 还是遵照小程序的书写规范原则，只不过在 web 侧做一定的兼容处理。

对于 json 配置来说，需要解决的核心问题是：

1. 将原本松散的小程序页面/组件之间的依赖关系转化为满足 vue sfc 处理规范下；

在小程序的规范当中，json 配置（组件依赖关系是松散的）是在小程序框架内部去完成依赖关系确认的。那么对于小程序跨 web 的场景来说，比较重要的一点就是解析 json 配置的内容并完成组件的路径收集，这部分的内容最终是需要合并到 vue options 当中。就类似于在开发 vue 项目的时候进行的组件的依赖关系的申明。因此对于 mpx sfc 来说，json 配置的编译处理也是先于 script 的。在小程序规范当中，有严格的 Page/Component 的配置区分，那么进入到 `processJSON` 处理流程当中需要处理并收集这部分的路径，然后交给 script 的处理流程。

对于 script 来说，在 vue sfc 当中 script 需要明确导出 options 配置内容(`export default {}`)。但是在小程序规范当中，在 script 当中只需要调用 `Page、Component`(mpx 当中是 @mpxjs/core 暴露出来的 `createPage、createComponent`) 全局方法，因此对于 script 的处理需要解决的几个核心问题就是：

1. options 导出；
2. json 配置和 script options 合并；

对于第一个问题，实际上 `createComponent` 是对于 `Component` 的一层包装，内部最终会调用 `Component`，但是在 web 场景下肯定是没有这个全局方法的，所以在 web 侧下调用 createComponent 方法，这个方法内部针对在 web 场景下最终会将 options 挂载至 `global.currentOpiton` 下，这样在运行时阶段相关 options 可以从这上面获取。此外针对 options 的导出注入了运行时的代码：

```javascript
// processScript.js
module.exports = function (script, options) {
  ...
  let content = `\n import processOption, { getComponent, getWxsMixin } from ${stringifyRequest(optionProcessorPath)}\n`

  content += 'const currentOption = global.currentOption\n'
  ...
  content += `export default processOptions(
    currentOption,
    ${JSON.stringify(ctorType)},
    ${JSON.stringify(firstPage)},
    ${JSON.stringify(outputPath)},
    ${JSON.stringify(pageConfig)},
    // @ts-ignore
    ${shallowStringify(pagesMap)},
    // @ts-ignore
    ${shallowStringify(componentsMap)},
    ${JSON.stringify(tabBarMap)},
    ${JSON.stringify(componentGenerics)},
    ${JSON.stringify(genericsInfo)},
    getWxsMixin(wxsModules)
    `

    if (ctorType === 'app') {
      content += `,
    Vue,
    VueRouter`
        if (i18n) {
          content += `,
    i18n`
        }
    }
    content += `\n  )\n`
}
```

另外在注入的代码当中提供了 `processOptions` 方法，这个方法实际上会将原始的 options(开发者写的 options 配置)以及在 `processJSON` 阶段收集起来的页面/组件做进一步的合并处理，执行的最终结果是满足 vue sfc 规范处理的文本内容。


### 运行时环节

在编译环节主要是解决了 mpx 小程序和 vue 开发规范之间差异，通过 mpx-loader 当中对于 web 场景下信息的收集、转化以及注入一些辅助函数用以在运行时代码执行阶段。而在运行时环节，mpx 对于每个 vue 组件实例同样也做了一层代理(和对于小程序 this 做代理一样)

在运行时环节需要解决的几个核心的问题：

1. 生命周期
2. API 抹平
3. 响应式数据/视图更新

对于第一点，小程序和 vue 的生命周期直观上是没有拉齐的，首先小程序的 Page 和 Component 的生命周期就是不一致的，而 vue 整体都是基于组件的，所以对于 vue 组件来说生命周期是一致的。那么针对生命周期抹平的这个问题，首先肯定是依托于不同平台自身的生命周期的入口，最终收敛至 mpx 代理内部来做生命周期的统一。

```javascript
// core/src/platform/patch/web/getDefaultOptions.js
export function getDefaultOptions (type, { rawOptions = {} }) {
  const rootMixins = [{
    created() {
      if (!this.__mpxProxy) {
        ...
        initProxy(this, rawOptions, [query])
      }
    },
    mounted() {
      this.__mpxProxy && this.__mpxProxy.mounted()
    },
    updated() {
      this.__mpxProxy && this.__mpxProxy.mounted()
    },
    destoryed() {
      this.__mpxProxy && this.__mpxProxy.mounted()
    }
  }]
  rawOptions.mixins = rawOptions.mixins ? rootMixins.concat(rawOptions.mixins) : rootMixins
  rawOptions = mergeOptions(rawOptions, type, false)
  return filterOptions(rawOptions)
}

// core/src/platform/patch/wx/getDefaultOptions.js
export function getDefaultOptions (type, { rawOptions = {}, currentInject }) {
  let hookNames = ['attached', 'ready', 'detached']
  // 当用户传入page作为构造器构造页面时，修改所有关键hooks
  if (rawOptions.__pageCtor__) {
    hookNames = ['onLoad', 'onReady', 'onUnload']
  }
  const rootMixins = [{
    [hookNames[0]] (...params) {
      if (!this.__mpxProxy) {
        initProxy(this, rawOptions, currentInject, params)
      }
    },
    [hookNames[1]] () {
      this.__mpxProxy && this.__mpxProxy.mounted()
    },
    [hookNames[2]] () {
      this.__mpxProxy && this.__mpxProxy.destroyed()
    }
  }]
  rawOptions.mixins = rawOptions.mixins ? rootMixins.concat(rawOptions.mixins) : rootMixins
  rawOptions = mergeOptions(rawOptions, type, false)
  return filterOptions(rawOptions)
}
```

所以最终的效果就是以小程序平台为规范的生命周期最终是在 mpx 代理层做了对应的抹平工作。


对于第二点，mpx 提供了一个单独的 npm package: `@mpxjs/api-proxy`，用以对 api 做平台的抹平相关的工作，使用的方式就是 `mpx.xxxFn` 这种形式，在编译环节这里的 mpx 就会转化到对应平台。这里可以举一个路由的例子：在小程序规范里面，需要在 app.json 里面申明所有的 pages 也就代表了不同的页面路由，小程序框架内部会依据这些配置做路由相关的注册，在 api 使用上提供了 `wx.navigateTo`，`wx.redirectTo` 等相关的路由 api，这些 api 在 vue 里面等价于 vueRouter 提供的 `route.push`，`route.replace` 等方法。所以在 `@mpxjs/api-proxy` 里面所做的工作就是使用 mpx 暴露出来的这些路由相关的行为在小程序和 vue 表现一致。

```javascript
// api-proxy/src/web/api/route/index.js

function navigateTo (options = {}) {
  // mpx 注入的 vueRouter 实例 @mpxjs/webpack-plugin/lib/runtime/optionProcessor.js
  const router = global.__mpxRouter
  if (router) {
    ...
    // 抹平小程序的 eventChannel 功能
    const eventChannel = new EventChannel()
    router.__mpxAction = {
      type: 'to',
      eventChannel
    }
    if (options.events) {
      eventChannel._addListeners(options.events)
    }
    return new Promise((resolve, reject) => {
      // 推入路由栈
      router.push(
        {
          path: options.url
        },
        () => {
          const res = { errMsg: 'navigateTo: ok', eventChannel }
          webHandleSuccess(res, options.success, options.complete)
          resolve(res)
        },
        () => {
          const res = { errMsg: err }
          webHandleFail(res, options.fail, options.complete)
          reject(res)
        }
      )
    })
  }
}


// @mpxjs/webpack-plugin/lib/runtime/optionProcessor.js
export default function processOption () {
  ...
  if (routes.length) {
    global.__mpxRouter = option.router = new VueRouter({
      ...webRouteConfig,
      routes
    })
    global.__mpxRouter.stack = []
    global.__mpxRouter.needCache = null
    global.__mpxRouter.needRemove = []
    global.__mpxRouter.beforeEach(function (to, from, next) {
      ...
      switch (action.type) {
        case 'to':
          ...
        case 'back':
          ...
        case 'redirect': 
          ...
        case 'switch':
          ...
        case 'relaunch':
          ...
      }
    })
  }
}
```

对于第三点，mpx 对于小程序做了响应式数据的增强，引入了 render 函数，最终使用效果和 vue 的响应式数据类似。那么在 web 场景下，因为 vue 已经提供了响应式的能力，所以对于响应式数据不需要做任何的处理工作，在 `src/core/proxy.js`：

```javascript
export default class MPXProxy {
  constructor(options, target) {
    ...
    if (__mpx_mode__ !== 'web') {
      this._watchers = []
      this._watcher = null
      this.localKeysMap = {}
      this.renderData = {}
      this.miniRenderData = {}
      this.forceUpdateData = {}
      this.forceUpdateAll = false
      this.curRenderTask = null
    }
  }

  created() {
    ...
    if (__mpx_mode__ !== 'web') {
      this.initState(this.options)
    }
    ...
    if (__mpx_mode__ !== 'web') {
      this.options.__nativeRender__ ? this.doRender() : this.initRender()
    }
  }

  initApi() {
    ...
    if (__mpx_mode__ !== 'web') {
      this.target.$watch = (...rest) => this.watch(...rest)
      this.target.$forceUpdate = (...rest) => this.forceUpdate(...rest)
      this.target.$nextTick = fn => this.nextTick(fn)
    }
  }
}
```

所以在 web 场景下，对于小程序的一些增强的能力就不需要执行了，统一由 vue 去接管。