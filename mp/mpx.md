# Mpx 小程序框架技术揭秘

与目前业内的几个小程序框架相比较而言，mpx 开发设计的出发点就是基于原生的小程序去做功能增强。所以从开发框架的角度来说，是没有任何“包袱”，围绕着原生小程序这个 core 去做不同功能的 patch 工作，使得开发小程序的体验更好。

于是我挑了一些我非常感兴趣的点去学习了下 mpx 在相关功能上的设计与实现。

## 编译环节

### 动态入口编译

不同于 web 规范，我们都知道小程序每个 page/component 需要被最终在 webview 上渲染出来的内容是需要包含这几个独立的文件的：js/json/wxml/wxss。为了提升小程序的开发体验，mpx 参考 vue 的 SFC(single file component)的设计思路，采用单文件的代码组织方式进行开发。既然采用这种方式去组织代码的话，那么模板、逻辑代码、json配置文件、style样式等都放到了同一个文件当中。那么 mpx 需要做的一个工作就是如何将 SFC 在代码编译后拆分为 js/json/wxml/wxss 以满足小程序技术规范。熟悉 vue 生态的同学都知道，vue-loader 里面就做了这样一个编译转化工作。具体有关 vue-loader 的工作流程可以参见我写的[文章](https://github.com/CommanderXL/Biu-blog/issues/33)。

这里会遇到这样一个问题，就是在 vue 当中，如果你要引入一个页面/组件的话，直接通过`import`语法去引入对应的 vue 文件即可。但是在小程序的标准规范里面，它有自己一套组件系统，即如果你在某个页面/组件里面想要使用另外一个组件，那么需要在你的 json 配置文件当中去声明`usingComponents`这个字段，对应的值为这个组件的路径。

(🤔：这里有个问题就是为什么不把 json 配置给干掉，直接到 js 里面新增一个字段进行相关的配置呢？)

在 vue 里面 import 一个 vue 文件，那么这个文件会被当做一个 dependency 去加入到 webpack 的编译流程当中。但是 mpx 是保持小程序原有的功能，去进行功能的增强。因此一个 mpx 文件当中如果需要引入其他页面/组件，那么就是遵照小程序的组件规范需要在`usingComponents`定义好`组件名:路径`即可，**mpx 提供的 webpack 插件来完成确定依赖关系，同时将被引入的页面/组件加入到编译构建的环节当中**。

TODO: webpack-plugin 和 loader 的附属关系的实现

接下来就来看下具体的实现，mpx webpack-plugin 暴露出来的插件上也提供了静态方法去使用 loader。这个 loader 的作用和 vue-loader 的作用类似，首先就是拿到 mpx 原始的文件后转化一个 js 文本的文件。例如一个 list.mpx 文件里面有关 json 的配置会被编译为：

```javascript
require("!!../../node_modules/@mpxjs/webpack-plugin/lib/extractor?type=json&index=0!../../node_modules/@mpxjs/webpack-plugin/lib/json-compiler/index?root=!../../node_modules/@mpxjs/webpack-plugin/lib/selector?type=json&index=0!./list.mpx")
```

这样可以清楚的看到 list.mpx 这个文件首先 selector(抽离`list.mpx`当中有关 json 的配置，并传入到 json-compiler 当中) --->>> json-compiler(对 json 配置进行处理，添加动态入口等) --->>> extractor(利用 child compiler 单独生成 json 配置文件)

其中动态添加入口的处理流程是在 json-compiler 当中去完成的。例如在你的 `page/home.mpx` 文件当中的 json 配置中使用了 局部组件 `components/list.mpx`:

```javascript
<script type="application/json">
  {
    "usingComponents": {
      "list": "../components/list"
    }
  }
</script>
```

在 json-compiler 当中：

```javascript
...

const addEntrySafely = (resource, name, callback) => {
  // 如果loader已经回调，就不再添加entry
  if (callbacked) return callback()
  // 使用 webpack 提供的 SingleEntryPlugin 插件创建一个单文件的入口依赖(即这个 component)
  const dep = SingleEntryPlugin.createDependency(resource, name)
  entryDeps.add(dep)
  // compilation.addEntry 方法开始将这个需要被编译的 component 作为依赖添加到 webpack 的构建流程当中
  // 这里可以看到的是整个动态添加入口文件的过程是深度优先的
  this._compilation.addEntry(this._compiler.context, dep, name, (err, module) => {
    entryDeps.delete(dep)
    checkEntryDeps()
    callback(err, module)
  })
}

const processComponent = (component, context, rewritePath, componentPath, callback) => {
  ...
  // 调用 loaderContext 上提供的 resolve 方法去解析这个 component path 完整的路径，以及这个 component 所属的 package 相关的信息(例如 package.json 等)
  this.resolve(context, component, (err, rawResult, info) => {
    ...
    componentPath = componentPath || path.join(subPackageRoot, 'components', componentName + hash(result), componentName)
    ...
    // component path 解析完之后，调用 addEntrySafely 开始在 webpack 构建流程中动态添加入口
    addEntrySafely(rawResult, componentPath, callback)
  })
}

if (isApp) {
  ...
} else {
  if (json.usingComponents) {
    // async.forEachOf 流程控制依次调用 processComponent 方法
    async.forEachOf(json.usingComponents, (component, name, callback) => {
      processComponent(component, this.context, (path) => {
        json.usingComponents[name] = path
      }, undefined, callback)
    }, callback)
  }
  ...
}
...
```

这里需要解释说明下有关 webpack 提供的 SingleEntryPlugin 插件。这个插件是 webpack 提供的一个内置插件，当这个插件被挂载到 webpack 的编译流程的过程中是，会绑定`compiler.hooks.make.tapAsync`hook，当这个 hook 触发后会调用这个插件上的 SingleEntryPlugin.createDependency 静态方法去创建一个入口依赖，然后调用`compilation.addEntry`将这个依赖加入到编译的流程当中，这个是单入口文件的编译流程的最开始的一个步骤(具体可以参见 [Webpack SingleEntryPlugin 源码](https://github.com/webpack/webpack/blob/master/lib/SingleEntryPlugin.js))。

Mpx 正是利用了 webpack 提供的这样一种能力，在遵照小程序的自定义组件的规范的前提下，解析 mpx json 配置文件的过程中，手动的调用 SingleEntryPlugin 相关的方法去完成动态入口的添加工作。这样也就串联起了所有的 mpx 文件的编译工作。


### Render Function

Render Function 这块的内容我觉得是 Mpx 设计上的一大亮点内容。Mpx 引入 Render Function 主要解决的问题是性能优化方向相关的，因为小程序的架构设计，逻辑层和渲染层是2个独立的。

TODO: 描述下关于小程序架构相关的内容。

这里我直接引用 Mpx 有关 Render Function 对于性能优化相关的描述：

> 作为一个接管了小程序setData的数据响应开发框架，我们高度重视Mpx的渲染性能，通过小程序官方文档中提到的性能优化建议可以得知，setData对于小程序性能来说是重中之重，setData优化的方向主要有两个：

> * 尽可能减少setData调用的频次
> * 尽可能减少单次setData传输的数据
> 为了实现以上两个优化方向，我们做了以下几项工作：

> 将组件的静态模板编译为可执行的render函数，通过render函数收集模板数据依赖，只有当render函数中的依赖数据发生变化时才会触发小程序组件的setData，同时通过一个异步队列确保一个tick中最多只会进行一次setData，这个机制和Vue中的render机制非常类似，大大降低了setData的调用频次；

> 将模板编译render函数的过程中，我们还记录输出了模板中使用的数据路径，在每次需要setData时会根据这些数据路径与上一次的数据进行diff，仅将发生变化的数据通过数据路径的方式进行setData，这样确保了每次setData传输的数据量最低，同时避免了不必要的setData操作，进一步降低了setData的频次。

接下来我们看下 Mpx 是如何实现 Render Function 的。


### Wxs Module

## 运行时环节

### 响应式系统

### 基于数据路径的diff

### 数据更新

