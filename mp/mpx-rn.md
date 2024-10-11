在 Mpx 转 rn 的整体方案中所遵循的方向还是开发者以微信小程序的开发范式来输出 rn。

和 mpx 跨小程序平台/web 平台之间不一样的地方：todo 补个图

核心需要解决的问题有哪些？

## 编译构建

### 框架流程

在 rn 的工作流程当中

在技术选型当中，上层的 dsl 是 mpx。

在框架编译的流程当中，核心要做的工作就是如何将一个 mpx sfc 编译产出一个 js bundle。

也就是对应到 rn 的上层 js 代码。

### 整体编译

对于一个 .mpx 文件来说，不管在哪种编译模式下首先都会经过 webpack-plugin/loader 处理，在这个 loader 当中来分发到底进入哪种平台的编译流程。

对于 mpx2rn 来说和 web 类似，对于 mpx sfc 有个独立的文件处理流程：`webpack-plugin/lib/react/index.js`

```javascript
...
const processJSON = require('./processJSON')
const processMainScript = require('./processMainScript')
const processTemplate = require('./processTemplate')
const processStyles = require('./processStyles')
const processScript = require('./processScript')
...

module.exports = function() {
  if (ctorType === 'app' && !queryObj.isApp) {
    return processMainScript()
  }

  const mpx = loaderContext.getMpx()
  ...
  let output = ''
  return async.waterfall([
    (callback) => {
      async.parallel([
        (callback) => {
          processTemplate(parts.template, {...}, callback)
        },
        (callback) => {
          processStyle(parts.styles, {...}, callback)
        },
        (callback) => {
          processJSON(parts.json, {...}, callback)
        }
      ], (err, res) => {
        callback(err, res)
      })
    },
    ([templateRes, stylesRes, jsonRes], callback) => {

    }
  ])
}
```

这里的处理流程也很清晰：

1. 对于一个 .mpx 文件来说，如果是遇到了启动文件 app.mpx，那么直接进入到 `processMainScript` 的处理流程；
2. 如果是一个普通的 .mpx 文件（页面/组件），也就并行分别进入到处理 template/style/json 的处理流程，当这3个并行处理流程结束后，进入到 `processScript` 的处理流程当中，这个过程结束后也就结束了当前 loader 的处理流程；

那么对于一个 mpx2rn 的项目入口文件 `app.mpx` 而言，从功能定位上来看实际就对应到一个 rn 项目的入口文件，所以在对于 `app.mpx` 的编译转换的工作当中，也就是需要在这个处理过程中注入 rn 项目启动所需要的一些运行时的代码。

```javascript
// webpack-plugin/lib/react/processMainScript.js
module.exports = function() {
  const { i18n, projectName } = loaderContext.getMpx()

  let output = 'import { AppRegistry } from \'react-native\'\n'
  ...
  output += `var App = require(${stringifyRequest(loaderContext, addQuery(loaderContext.resource, { isApp: true }))}).default\n`
  output += `AppRegistry.registerComponent(${JSON.stringify(projectName)}, () => App)`

  callback(null, { output })
}
```

经过 processMainScript 的处理也就将 app.mpx 转化为一个 rn 项目当中入口文件的 js 代码，进而进入到后续的 js 代码的编译构建流程当中。

当然这里代码的编译转换并没有对于 app.mpx 文件内的不同 blocks（例如 json/style）等做处理，这里的处理流程仅仅是完成注入 rn 项目的启动代码，同时将 app.mpx 的代码路径也一并注入，接下来也就进入到 webpack 处理这段 js 代码的逻辑当中，进而也就分析到 require 了这个 app.mpx 入口文件，这样也就会进入到对于 app.mpx 文件本身的处理流程：从流程上来说这个 app.mpx 会重新进入到主 loader 的处理流程当中，但是这次处理过程不一样的地方是去处理这个文件本身当中不同 block 的逻辑（和一个普通的 .mpx 页面/组件服用一套处理流程）。

那么对于一个普通的 .mpx 页面/组件来说，首先是并行的处理 `template/style/json`：

对于 template 来说：

从源代码来说 template 是小程序的模版语法（类 vue），但是我们在开发 rn 或者 react 的项目时一般都使用 jsx 的语法来描述页面/组件的结构。所以对于 template 核心要解决的问题就是**如何将小程序的模版语法转换为 react 项目当中能产出页面/组件结构的语法**。

不过对于 react 来说，jsx 本身也就是一套描述组件结构的 dsl，它的实际功效和 template 模版一样，那也意味着我们将源码当中的 template 直接转化为 jsx 的写法也就能保证最终渲染出来的组件结构一致。如果是按照这个思路来解决模版渲染的问题，那么也就意味着我们需要写一个 template -> jsx 的转换器，同时还需要接入 jsx 相关的编译构建套件才能保障 jsx 正常的工作。不过在 react 当中也提供了 `createElement` 这样编程式的方式去创建我们的组件结构，它的功效和 jsx 等价。熟悉 Vue 技术体系的应该都清楚，对于一个 vue sfc 的 template block 来说最终都会经过编译构建转换为 render function，在 mpx2web 的技术架构当中，针对 template 的处理实际上也只是在 mpx 初次处理后转换符合 vue 的编译构建处理的模版，然后交由 vue 的编译构建套件去处理。因此这里对于 template 的处理也就是最终转化为 render function，这样也不需要单独借助 react 相关的工具来参与整个编译构建流程了。

那么在 template 的处理过程当中，首先经过 template-compiler：

```javascript
// webpack-plugin/lib/react/processTemplate.js
// 产出描述模版的 vnode tree
const { meta, root } = templateCompiler.parse(template.content, {
  ...
})
```

```javascript
// webpack-plugin/lib/template-compiler/compiler.js
function processElement(el, root, options, meta) {
  ...
  if (isReact(mode)) {
    // 收集内建组件
    processBuiltInComponents(el, meta)
    // 预处理代码维度条件编译
    processIf(el)
    processFor(el)
    processRefReact(el, meta)
    processStyleReact(el, options)
    processEventReact(el)
    processComponentIs(el, options)
    processSlotReact(el)
    processAttrs(el, options)
    return
  }
}

function closeElement(el, meta, options) {
  ...
  if (isReact(mode)) {
    postProcessWxs(el, meta)
    postProcessForReact(el)
    postProcessIfReact(el)
    return
  }
  ...
}
```

那么对于 template 的节点&属性处理，核心也就是在编译阶段将微信模版语法转化为 react 的 render function 代码。如果你对 vue 的技术体系比较熟悉，大概就清楚模版到 render function 的生成过程。例如遇到了 `wx:for` 处理循环的指令，就会针对这个指令单独注入一个辅助函数 `_i`，`wx:if` 处理条件判断的指令，就会生成三元表达式等。

对于 style 来说：

对于 json 来说：



### 模版指令

## 运行时

### 组件系统

在更为现代的 web 开发当中，每个框架都会有自己的一套组件系统，在不同的小程序平台一样也提供了组件开发的能力。在 mpx 的渐进增强的设计思路下，对于每个小程序的组件来说都会绑定一个**与平台无关的抽象的 mpxProxy 实例**，这个抽象的 mpxProxy 统一接管组件的生命周期，引入响应式系统，组件更新等等工作。另外一方面 mpxProxy 实例可以更好的做跨平台工作。

这里可以想象下，我们使用 mpx 作为上层的 dsl，将微信小程序平台作为基准能力，最终产出的代码一方面要在 rn 环境下正常运行，另外就是代码执行的结果要和微信小程序平台对齐。举个例子：

```javascript
// template
<template>
  <view>{{name}}</view>
</template>

// script
import { createComponent } from '@mpxjs/core'

createComponent({
  data: {
    name: 'John'
  },
  created() {
    // do something
  },
  ready() {
    this.name = 'David'
  }
})
```

在小程序平台下，组件实例在刚创建时会调用 `created` 生命周期，完成布局后会将 `name` 的值更新，之后组件的视图也会完成更新。

如果使用 rn 来实现这样的一个功能：

```javascript
const component = () => {
  const [name, setName] = useState('John')

  useEffect(() => {
    setName('David')
  }, [])

  return (
    <View>
      <Text>{name}</Text>
    </View>
  )
}
```

咋一眼看上去两者的编码的范式有着非常大的差异：

1. react 函数式组件没有生命周期的概念；
2. 示例当中 react 组件内部状态的更新都是通过 hooks 来驱动，这也和 mpx 的响应式系统有非常大的差异；


那么在 mpx2rn 的工作当中，react 本身也有自己的组件体系（这里说的都是函数式组件）设计，
同时 react 和 vue 在编码范式上也有非常大的区别。

### 组件渲染

### 事件

### 路由


* 构建流程
  * compiler 
* 模版编译
  * 指令
  * render function 生成
* 组件渲染
  * react 渲染流程接管
  * 响应式系统 + react
* 组件系统
  * memo 目前看起来有点鸡肋，主要每次 props 传的都是一个新的，而不是通过 useMemo/useCallback 这些 hooks 生成的缓存的数据；
  * 组件配置
  * 组件生命周期
  * pageLifetimes
  * 基础组件的实现&注入
* 事件系统
  * 组件的自定义事件
  * 基础组件的原生事件
* 路由实现
* 跨端平台
  * createApp
  * createPage
  * createComponent
* 平台能力
  * 以微信平台为标准的能力对齐
* 原生组件&第三方组件引入使用
  * @ios 
* 性能相关
  * 性能测试
  * 性能优化