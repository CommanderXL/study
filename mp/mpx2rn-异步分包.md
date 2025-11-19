## Mpx2Rn 异步分包


在 Mpx2RN 整个链路当中，涉及两个编译构建流程：

* mpx app -> webpack -> js bundle
* js bundle -> metro -> HBC

在 Mpx2RN 的场景下是**以微信小程序的异步分包为规范在 RN 平台下完成同等能力的实现**，具体体现在：

* wx.onLazyLoadError
* js bundle 异步分包 - `require.async` api
* 页面/组件的异步分包能力

等。

规范只约定了能力的表现，一方面是上层框架，另一方面是宿主平台能力。

在实际进入到 Mpx2RN 分包能力分享之前，先简单聊下 Mpx 在跨其他平台的场景当中是如何去实现异步分包的能力。从平台视角来看主要是分为小程序平台（wx/ali/tt 等），web 以及 RN。在小程序的平台场景下，由平台提供异步分包的底层的能力(包的加载、执行等能力)，对于上层的小程序应用来说完全黑盒，Mpx 在跨小程序平台的场景下只需要保证最终的代码符合分包输出规范，再交由不同的宿主小程序平台去完成最终的分包代码的编译和输出来保障分包能力的使用。

但是对于 Mpx2Web 的场景来说，代码运行的宿主是浏览器，**浏览器本身提供了动态插入 script 标签异步加载并执行 js 代码的能力**。在 Mpx2Web 的运行时阶段，页面的渲染完全由 Vue 去接管(具体的技术细节可以参见[这篇文章](https://github.com/CommanderXL/Biu-blog/issues/56))，Vue 提供了[异步组件](https://v2.cn.vuejs.org/v2/guide/components-dynamic-async.html#%E5%BC%82%E6%AD%A5%E7%BB%84%E4%BB%B6)的能力，那么 Mpx2Web 的场景要**遵照微信小程序的规范来实现异步分包的能力**，最终也就是在编译构建阶段转为 Vue 异步组件。

Mpx 侧来完成代码的转换，构建工具 webpack 完成拆包，运行时代码的处理。平台侧提供下包的能力。

再回到 Mpx2RN 的场景，宿主是 RN，但是它并没有提供直接可用的异步加载并执行 js 代码的能力。此外......

对于一个 mpx sfc 来说，不管是页面还是组件，最终都是由一个 react component 去承载。伪代码：

```javascript
createElement('...')
```

react async component container，dynamic import 的桥接，所以最终页面/组件的代码最终都会变为异步执行的策略。

* import 转换能力
* require.async 转换能力 -> 桥接到 dynamic import 的能力

### Webpack Code Splitting

* 模块拆分
* 模块加载
* 模块管理

webpack RuntimeModule

### 分包页面

在小程序的技术开发规范当中有 Page 概念及所对应的 Page 行为和方法，不过在 react 当中并没有等价的 Page，对于 Mpx2RN 来说也就需要通过**react 自定义组件作为载体来模拟实现小程序规范当中的 Page 能力**。此外，和 Page 息息相关的还有路由系统，在小程序的技术规范当中提供了专门的路由 api 来供我们进行页面间的相互跳转、回退。

不管是 Page 还是路由系统的底层能力实现都由小程序平台来提供，那么在 Mpx2RN 的场景下需要有对等的实现，在这种情况下 Mpx 作为上层的 DSL，实际的渲染工作完全是交由 RN 来进行的。

`@react-navigation` 来作为路由系统

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
        return createElement(Stack.Screen, {
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

在编译阶段将（异步分包）页面处理为...
运行时阶段由 RN 来接管实际的渲染工作；

### 分包组件

mpx 通过扩展语法能力；
异步分包的组件可以通过在引入阶段通过 `root` 来声明当前组件为通过异步分包的形式引入以及指定需要被分配到哪个具体的分包当中。

### 分包 js bundle

对于分包 js bundle 来说，源码当中使用微信小程序的 `require.async` api 来标识所依赖的 js bundle 是异步加载的，但是 `require.async` api 并不像 webpack 提供的 dynamic import 所识别。所以针对 `require.async` 引入的 js bundle 在编译环节核心要解决2个问题：

* 添加 AsyncDependenciesBlock
* 添加 ImportDependency


在编译环节主要借助 Webpack Code Splitting 的能力进行拆包，在运行时环节 xxx

在没有实现分包能力之前，所有的代码最终都会打成一个 js bundle，体积会大，加载时间会变长。


* 非常有技术复杂度的一个项目
<!-- * 问题分析(mpx、rn、微信平台能力设计)
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