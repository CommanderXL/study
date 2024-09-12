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



### 模版指令

## 运行时

### 组件系统

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