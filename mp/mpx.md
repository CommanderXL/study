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

这里直接引用 Mpx 有关 Render Function 对于性能优化相关开发工作的描述：

> 作为一个接管了小程序setData的数据响应开发框架，我们高度重视Mpx的渲染性能，通过小程序官方文档中提到的性能优化建议可以得知，setData对于小程序性能来说是重中之重，setData优化的方向主要有两个：

> * 尽可能减少setData调用的频次
> * 尽可能减少单次setData传输的数据
> 为了实现以上两个优化方向，我们做了以下几项工作：

> 将组件的静态模板编译为可执行的render函数，通过render函数收集模板数据依赖，只有当render函数中的依赖数据发生变化时才会触发小程序组件的setData，同时通过一个异步队列确保一个tick中最多只会进行一次setData，这个机制和Vue中的render机制非常类似，大大降低了setData的调用频次；

> 将模板编译render函数的过程中，我们还记录输出了模板中使用的数据路径，在每次需要setData时会根据这些数据路径与上一次的数据进行diff，仅将发生变化的数据通过数据路径的方式进行setData，这样确保了每次setData传输的数据量最低，同时避免了不必要的setData操作，进一步降低了setData的频次。

接下来我们看下 Mpx 是如何实现 Render Function 的。这里我们从一个简单的 demo 来说起：

```javascript
<template>
  <text>Computed reversed message: "{{ reversedMessage }}"</text>
  <view>the c string {{ demoObj.a.b.c }}</view>
  <view wx:class="{{ { active: isActive } }}"></view>
</template>

<script>
import { createComponent } from "@mpxjs/core";

createComponent({
  data: {
    isActive: true,
    message: 'messages',
    demoObj: {
      a: {
        b: {
          c: 'c'
        }
      }
    }
  },
  computed() {
    reversedMessage() {
      return this.message.split('').reverse().join('')
    }
  }
})

</script>
```

`.mpx` 文件经过 loader 编译转换的过程中。对于 template 模块的处理和 vue 类似，首先将 template 转化为 AST，然后再将 AST 转化为 code 的过程中做相关转化的工作，最终得到我们需要的 template 模板代码。

在`packages/webpack-plugin/lib/template-compiler.js`模板处理 loader 当中:

```javascript
let renderResult = bindThis(`global.currentInject = {
    moduleId: ${JSON.stringify(options.moduleId)},
    render: function () {
      var __seen = [];
      var renderData = {};
      ${compiler.genNode(ast)}return renderData;
    }
};\n`, {
    needCollect: true,
    ignoreMap: meta.wxsModuleMap
  })
```

在 render 方法内部，创建 renderData 局部变量，调用`compiler.genNode(ast)`方法完成 Render Function 核心代码的生成工作，最终将这个 renderData 返回。例如在上面给出来的 demo 实例当中，通过`compiler.genNode(ast)`方法最终生成的代码为：

```javascript
((mpxShow)||(mpxShow)===undefined?'':'display:none;');
if(( isActive )){
}
"Computed reversed message: \""+( reversedMessage )+"\"";
"the c string "+( demoObj.a.b.c );
(__injectHelper.transformClass("list", ( {active: isActive} )));
```

TODO: compiler.genNode 方法的具体的流程实现思路

mpx 文件当中的 template 模块被初步处理成上面的代码后，可以看到这是一段可执行的 js 代码。那么这段 js 代码到底是用作何处呢？可以看到`compiler.genNode`方法是被包裹至`bindThis`方法当中的。即这段 js 代码还会被`bindThis`方法做进一步的处理。打开 bind-this.js 文件可以看到内部的实现其实就是一个 babel 的 transform plugin。在处理上面这段 js 代码的 AST 的过程中，通过这个插件对 js 代码做进一步的处理。最终这段 js 代码处理后的结果是：

TODO: Babel 插件的具体功效

```javascript
/* mpx inject */ global.currentInject = {
  moduleId: "2271575d",
  render: function () {
    var __seen = [];
    var renderData = {};
    (renderData["mpxShow"] = [this.mpxShow, "mpxShow"], this.mpxShow) || (renderData["mpxShow"] = [this.mpxShow, "mpxShow"], this.mpxShow) === undefined ? '' : 'display:none;';
    "Computed reversed message: \"" + (renderData["reversedMessage"] = [this.reversedMessage, "reversedMessage"], this.reversedMessage) + "\"";
    "the c string " + (renderData["demoObj.a.b.c"] = [this.demoObj.a.b.c, "demoObj"], this.__get(this.__get(this.__get(this.demoObj, "a"), "b"), "c"));
    this.__get(__injectHelper, "transformClass")("list", { active: (renderData["isActive"] = [this.isActive, "isActive"], this.isActive) });
    return renderData;
  }
};
```

bindThis 方法对于 js 代码的转化规则就是：

1. 一个变量的访问形式，改造成 this.xxx 的形式；
2. 对象属性的访问形式，改造成 this.__get(object, property) 的形式(this.__get方法为运行时 mpx runtime 提供的方法)

这里的 this 为 mpx 构造的一个代理对象，在你业务代码当中调用 createComponent/createPage 方法传入的配置项，例如 data，都会通过这个代理对象转化为响应式的数据。

需要注意的是不管哪种数据形式的改造，最终需要达到的效果就是确保在 Render Function 执行的过程当中，这些被模板使用到的数据能被正常的访问到，在访问的阶段中，这些被访问到的数据即被加入到 mpx 构建的整个响应式的系统当中。

只要在 template 当中使用到的 data 数据(包括衍生的 computed 数据)，最终都会被 renderData 所记录，而记录的数据形式是例如：

```javascript
renderData['xxx'] = [this.xxx, 'xxx'] // 数组的形式，第一项为这个数据实际的值，第二项为这个数据的 firstKey(主要用以数据 diff 的工作)
```

以上就是 mpx 生成 Render Function 的整个过程。总结下 Render Function 所做的工作：

1. 执行 render 函数，将渲染模板使用到的数据加入到响应式的系统当中；
2. 返回 renderData 用以接下来的数据 diff 以及调用小程序的 setData 方法来完成视图的更新

### Wxs Module

Wxs 是小程序自己推出的一套脚本语言。[官方文档](https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/01wxs-module.html)给出的示例，wxs 模块必须要声明式的被 wxml 引用。和 js 在 jsCore 当中去运行不同的是 wxs 是在渲染线程当中去运行的。因此 wxs 的执行便少了一次从 jsCore 执行的线程和渲染线程的通讯，从这个角度来说是对代码执行效率和性能上的比较大的一个优化手段。

有关官方提到的有关 wxs 的运行效率的问题还有待论证：

> “在 android 设备中，小程序里的 wxs 与 js 运行效率无差异，而在 ios 设备中，小程序里的 wxs 会比 js 快 2~20倍。”

因为 mpx 是对小程序做渐进增强，因此 wxs 的使用方式和原生的小程序保持一致。在你的`.mpx`文件当中的 template block 内通过路径直接去引入 wxs 模块即可使用：

```javascript
<template>
  <wxs src="../wxs/components/list.wxs" module="list">
  <view>{{ list.FOO }}</view>
</template>


// wxs/components/list.wxs

const Foo = 'This is from list wxs module'
module.exports = {
  Foo
}
```

在 template 模块经过 template-compiler 处理的过程中。模板编译器 compiler 在解析模板的 AST 过程中会针对 wxs 标签缓存一份 wxs 模块的映射表：

```javascript
{
  meta: {
    wxsModuleMap: {
      list: '../wxs/components/list.wxs'
    }
  }
}
```

当 compiler 对 template 模板解析完后，template-compiler 接下来就开始处理 wxs 模块相关的内容：

```javascript
// template-compiler/index.js

module.exports = function (raw) {
  ...

  const addDependency = dep => {
    const resourceIdent = dep.getResourceIdentifier()
    if (resourceIdent) {
      const factory = compilation.dependencyFactories.get(dep.constructor)
      if (factory === undefined) {
        throw new Error(`No module factory available for dependency type: ${dep.constructor.name}`)
      }
      let innerMap = dependencies.get(factory)
      if (innerMap === undefined) {
        dependencies.set(factory, (innerMap = new Map()))
      }
      let list = innerMap.get(resourceIdent)
      if (list === undefined) innerMap.set(resourceIdent, (list = []))
      list.push(dep)
    }
  }

  // 如果有 wxsModuleMap 即为 wxs module 依赖的话，那么下面会调用 compilation.addModuleDependencies 方法
  // 将 wxsModule 作为 issuer 的依赖再次进行编译，最终也会被打包进输出的模块代码当中
  // 需要注意的就是 wxs module 不仅要被注入到 bundle 里的 render 函数当中，同时也会通过 wxs-loader 处理，单独输出一份可运行的 wxs js 文件供 wxml 引入使用
  for (let module in meta.wxsModuleMap) {
    isSync = false
    let src = meta.wxsModuleMap[module]
    const expression = `require(${JSON.stringify(src)})`
    const deps = []
    // parser 为 js 的编译器
    parser.parse(expression, {
      current: { // 需要注意的是这里需要部署 addDependency 接口，因为通过 parse.parse 对代码进行编译的时候，会调用这个接口来获取 require(${JSON.stringify(src)}) 编译产生的依赖模块
        addDependency: dep => {
          dep.userRequest = module
          deps.push(dep)
        }
      },
      module: issuer
    })
    issuer.addVariable(module, expression, deps) // 给 issuer module 添加 variable 依赖
    iterationOfArrayCallback(deps, addDependency)
  }

  // 如果没有 wxs module 的处理，那么 template-compiler 即为同步任务，否则为异步任务
  if (isSync) {
    return result
  } else {
    const callback = this.async()

    const sortedDependencies = []
    for (const pair1 of dependencies) {
      for (const pair2 of pair1[1]) {
        sortedDependencies.push({
          factory: pair1[0],
          dependencies: pair2[1]
        })
      }
    }

    // 调用 compilation.addModuleDependencies 方法，将 wxs module 作为 issuer module 的依赖加入到编译流程中
    compilation.addModuleDependencies(
      issuer,
      sortedDependencies,
      compilation.bail,
      null,
      true,
      () => {
        callback(null, result)
      }
    )
  }
}
```


### template/script/style/json 模块单文件的生成

不同于 Vue 借助 webpack 是将 Vue 单文件最终打包成单独的 js chunk 文件。而小程序的规范是每个页面/组件需要对应的 wxml/js/wxss/json 4个文件。因为 mpx 使用单文件的方式去组织代码，所以在编译环节所需要做的工作之一就是将 mpx 单文件当中不同 block 的内容拆解到对应文件类型当中。在动态入口编译的小节里面我们了解到 mpx 会分析每个 mpx 文件的引用依赖，从而去给这个文件创建一个 entry 依赖(SingleEntryPlugin)并加入到 webpack 的编译流程当中。我们还是继续看下 mpx loader 对于 mpx 单文件初步编译转化后的内容：

```javascript
/* script */
export * from "!!babel-loader!../../node_modules/@mpxjs/webpack-plugin/lib/selector?type=script&index=0!./list.mpx"

/* styles */
require("!!../../node_modules/@mpxjs/webpack-plugin/lib/extractor?type=styles&index=0!../../node_modules/@mpxjs/webpack-plugin/lib/wxss/loader?root=&importLoaders=1&extract=true!../../node_modules/@mpxjs/webpack-plugin/lib/style-compiler/index?{\"id\":\"2271575d\",\"scoped\":false,\"sourceMap\":false,\"transRpx\":{\"mode\":\"only\",\"comment\":\"use rpx\",\"include\":\"/Users/XRene/demo/mpx-demo-source/src\"}}!stylus-loader!../../node_modules/@mpxjs/webpack-plugin/lib/selector?type=styles&index=0!./list.mpx")

/* json */
require("!!../../node_modules/@mpxjs/webpack-plugin/lib/extractor?type=json&index=0!../../node_modules/@mpxjs/webpack-plugin/lib/json-compiler/index?root=!../../node_modules/@mpxjs/webpack-plugin/lib/selector?type=json&index=0!./list.mpx")

/* template */
require("!!../../node_modules/@mpxjs/webpack-plugin/lib/extractor?type=template&index=0!../../node_modules/@mpxjs/webpack-plugin/lib/wxml/wxml-loader?root=!../../node_modules/@mpxjs/webpack-plugin/lib/template-compiler/index?{\"usingComponents\":[],\"hasScoped\":false,\"isNative\":false,\"moduleId\":\"2271575d\"}!../../node_modules/@mpxjs/webpack-plugin/lib/selector?type=template&index=0!./list.mpx")
```

接下来可以看下 styles/json/template 这3个 block 的处理流程是什么样。

首先来看下 json block 的处理流程：`list.mpx -> json-compiler -> extractor`。第一个阶段 list.mpx 文件经由 json-compiler 的处理流程在前面的章节已经讲过，主要就是分析依赖增加动态入口的编译过程。当所有的依赖分析完后，调用 json-compiler loader 的异步回调函数：

```javascript
// lib/json-compiler/index.js

module.exports = function (content) {

  ...
  const nativeCallback = this.async()
  ...

  let callbacked = false
  const callback = (err, processOutput) => {
    checkEntryDeps(() => {
      callbacked = true
      if (err) return nativeCallback(err)
      let output = `var json = ${JSON.stringify(json, null, 2)};\n`
      if (processOutput) output = processOutput(output)
      output += `module.exports = JSON.stringify(json, null, 2);\n`
      nativeCallback(null, output)
    })
  }
}
```

这里我们可以看到经由 json-compiler 处理后，通过`nativeCallback`方法传入下一个 loader 的文本内容形如：

```javascript
var json = {
  "usingComponents": {
    "list": "/components/list397512ea/list"
  }
}

module.exports = JSON.stringify(json, null, 2)
```

即这段文本内容会传递到下一个 loader 内部进行处理，即 extractor。接下来我们来看下 extractor 里面主要是实现了哪些功能：

```javascript
// lib/extractor.js

module.exports = function (content) {
  ...
  const contentLoader = normalize.lib('content-loader')
  let request = `!!${contentLoader}?${JSON.stringify(options)}!${this.resource}` // 构建一个新的 resource，且这个 resource 只需要经过 content-loader
  let resultSource = defaultResultSource
  const childFilename = 'extractor-filename'
  const outputOptions = {
    filename: childFilename
  }
  // 创建一个 child compiler
  const childCompiler = mainCompilation.createChildCompiler(request, outputOptions, [
    new NodeTemplatePlugin(outputOptions),
    new LibraryTemplatePlugin(null, 'commonjs2'), // 最终输出的 chunk 内容遵循 commonjs 规范的可执行的模块代码 module.exports = (function(modules) {})([modules])
    new NodeTargetPlugin(),
    new SingleEntryPlugin(this.context, request, resourcePath),
    new LimitChunkCountPlugin({ maxChunks: 1 })
  ])

  ...
  childCompiler.hooks.thisCompilation.tap('MpxWebpackPlugin ', (compilation) => {
    // 创建 loaderContext 时触发的 hook，在这个 hook 触发的时候，将原本从 json-compiler 传递过来的 content 内容挂载至 loaderContext.__mpx__ 属性上面以供接下来的 content -loader 来进行使用
    compilation.hooks.normalModuleLoader.tap('MpxWebpackPlugin', (loaderContext, module) => {
      // 传递编译结果，子编译器进入content-loader后直接输出
      loaderContext.__mpx__ = {
        content,
        fileDependencies: this.getDependencies(),
        contextDependencies: this.getContextDependencies()
      }
    })
  })

  let source

  childCompiler.hooks.afterCompile.tapAsync('MpxWebpackPlugin', (compilation, callback) => {
    // 这里 afterCompile 产出的 assets 的代码当中是包含 webpack runtime bootstrap 的代码，不过需要注意的是这个 source 模块的产出形式
    // 因为使用了 new LibraryTemplatePlugin(null, 'commonjs2') 等插件。所以产出的 source 是可以在 node 环境下执行的 module
    // 因为在 loaderContext 上部署了 exec 方法，即可以直接执行 commonjs 规范的 module 代码，这样就最终完成了 mpx 单文件当中不同模块的抽离工作
    source = compilation.assets[childFilename] && compilation.assets[childFilename].source()

    // Remove all chunk assets
    compilation.chunks.forEach((chunk) => {
      chunk.files.forEach((file) => {
        delete compilation.assets[file]
      })
    })

    callback()
  })

  childCompiler.runAsChild((err, entries, compilation) => {
    ...
    try {
      // exec 是 loaderContext 上提供的一个方法，在其内部会构建原生的 node.js module，并执行这个 module 的代码
      // 执行这个 module 代码后获取的内容就是通过 module.exports 导出的内容
      let text = this.exec(source, request)
      if (Array.isArray(text)) {
        text = text.map((item) => {
          return item[1]
        }).join('\n')
      }

      let extracted = extract(text, options.type, resourcePath, +options.index, selfResourcePath)
      if (extracted) {
        resultSource = `module.exports = __webpack_public_path__ + ${JSON.stringify(extracted)};`
      }
    } catch (err) {
      return nativeCallback(err)
    }
    if (resultSource) {
      nativeCallback(null, resultSource)
    } else {
      nativeCallback()
    }
  })
}
```

稍微总结下上面的处理流程：

1. 构建一个以当前模块路径及 content-loader 的 resource 路径
2. 以这个 resource 路径作为入口模块，创建一个 childCompiler
3. childCompiler 启动后，创建 loaderContext 的过程中，将 content 文本内容挂载至 loaderContext.__mpx__ 上，这样在 content-loader 在处理入口模块的时候仅仅就是取出这个 content 文本内容并返回。实际上这个入口模块经过 loader 的过程不会做任何的处理工作，仅仅是将父 compilation 传入的 content 返回出去。
4. loader 处理模块的环节结束后，进入到 module.build 阶段，这个阶段对 content 内容没有太多的处理
5. createAssets 阶段，输出 chunk。
6. 将输出的 chunk 构建为一个原生的 node.js 模块并执行，获取从这个 chunk 导出的内容。也就是模块通过`module.exports`导出的内容。

所以上面的示例 demo 最终会输出一个 json 文件，里面包含的内容即为：

```javascript
{
  "usingComponents": {
    "list": "/components/list397512ea/list"
  }
}
```

## 运行时环节

以上几个章节主要是分析了几个 Mpx 在编译构建环节所做的工作。接下来我们来看下 Mpx 在运行时环节做了哪些工作。

### 响应式系统

小程序也是通过数据去驱动视图的渲染，需要手动的调用`setData`去完成这样一个动作。同时小程序的视图层也提供了用户交互的响应事件系统，在 js 代码中可以去注册相关的事件回调并在回调中去更改相关数据的值。Mpx 使用 Mobx 作为响应式数据工具并引入到小程序当中，使得小程序也有一套完成的响应式的系统，让小程序的开发有了更好的体验。

还是从组件的角度开始分析 mpx 的整个响应式的系统。每次通过`createComponent`方法去创建一个新的组件，这个方法将原生的小程序创造组件的方法`Component`做了一层代理，例如在 attched 的生命周期钩子函数内部会注入一个 mixin：

```javascript
// attached 生命周期钩子 mixin

attached() {
  // 提供代理对象需要的api
  transformApiForProxy(this, currentInject)
  // 缓存options
  this.$rawOptions = rawOptions // 原始的，没有剔除 customKeys 的 options 配置
  // 创建proxy对象
  const mpxProxy = new MPXProxy(rawOptions, this) // 将当前实例代理到 MPXProxy 这个代理对象上面去
  this.$mpxProxy = mpxProxy // 在小程序实例上绑定 $mpxProxy 的实例
  // 组件监听视图数据更新, attached之后才能拿到properties
  this.$mpxProxy.created()
}
```

在这个方法内部首先调用`transformApiForProxy`方法对组件实例上下文`this`做一层代理工作，在 context 上下文上去重置小程序的 setData 方法，同时拓展 context 相关的属性内容：

```javascript
function transformApiForProxy (context, currentInject) {
  const rawSetData = context.setData.bind(context) // setData 绑定对应的 context 上下文
  Object.defineProperties(context, {
    setData: { // 重置 context 的 setData 方法
      get () {
        return this.$mpxProxy.setData.bind(this.$mpxProxy)
      },
      configurable: true
    },
    __getInitialData: {
      get () {
        return () => context.data
      },
      configurable: false
    },
    __render: { // 小程序原生的 setData 方法
      get () {
        return rawSetData
      },
      configurable: false
    }
  })
  // context 绑定注入的render函数
  if (currentInject) {
    if (currentInject.render) { // 编译过程中生成的 render 函数
      Object.defineProperties(context, {
        __injectedRender: {
          get () {
            return currentInject.render.bind(context)
          },
          configurable: false
        }
      })
    }
    if (currentInject.getRefsData) {
      Object.defineProperties(context, {
        __getRefsData: {
          get () {
            return currentInject.getRefsData
          },
          configurable: false
        }
      })
    }
  }
}
```

接下来实例化一个 mpxProxy 实例并挂载至 context 上下文的 $mpxProxy 属性上，并调用 mpxProxy 的 created 方法完成这个代理对象的初始化的工作。在 created 方法内部主要是完成了以下的几个工作：

1. initApi，在组件实例 this 上挂载`$watch`,`$forceUpdate`,`$updated`,`$nextTick`等方法，这样在你的业务代码当中即可直接访问实例上部署好的这些方法；
2. initData
3. initComputed，将 computed 计算属性字段全部代理至组件实例 this 上；
4. 通过 Mobx observable 方法将 data 数据转化为响应式的数据；
5. initWatch，初始化所有的 watcher 实例；
6. initRender，初始化一个 renderWatcher 实例；

这里我们具体的来看下 initRender 方法内部是如何进行工作的：

```javascript
export default class MPXProxy {
  ...
  initRender() {
    let renderWatcher
    let renderExcutedFailed = false
    if (this.target.__injectedRender) { // webpack 注入的有关这个 page/component 的 renderFunction
      renderWatcher = watch(this.target, () => {
        if (renderExcutedFailed) {
          this.render()
        } else {
          try {
            return this.target.__injectedRender() // 执行 renderFunction，获取渲染所需的响应式数据
          } catch(e) {
            ...
          }
        }
      }, {
        handler: (ret) => {
          if (!renderExcutedFailed) {
            this.renderWithData(ret) // 渲染页面
          }
        },
        immediate: true,
        forceCallback: true
      })
    }
  }
  ...
}
```

在 initRender 方法内部非常清楚的看到，首先判断这个 page/component 是否具有 renderFunction，如果有的话那么就直接实例化一个 renderWatcher：

```javascript
export default class Watcher {
  constructor (context, expr, callback, options) {
    this.destroyed = false
    this.get = () => {
      return type(expr) === 'String' ? getByPath(context, expr) : expr()
    }
    const callbackType = type(callback)
    if (callbackType === 'Object') {
      options = callback
      callback = null
    } else if (callbackType === 'String') {
      callback = context[callback]
    }
    this.callback = typeof callback === 'function' ? action(callback.bind(context)) : null
    this.options = options || {}
    this.id = ++uid
    // 创建一个新的 reaction
    this.reaction = new Reaction(`mpx-watcher-${this.id}`, () => {
      this.update()
    })
    // 在调用 getValue 函数的时候，实际上是调用 reaction.track 方法，这个方法内部会自动执行 effect 函数，即执行 this.update() 方法，这样便会出发一次模板当中的 render 函数来完成依赖的收集
    const value = this.getValue()
    if (this.options.immediateAsync) { // 放置到一个队列里面去执行
      queueWatcher(this)
    } else { // 立即执行 callback
      this.value = value
      if (this.options.immediate) {
        this.callback && this.callback(this.value)
      }
    }
  }

  getValue () {
    let value
    this.reaction.track(() => {
      value = this.get() // 获取注入的 render 函数执行后返回的 renderData 的值，在执行 render 函数的过程中，就会访问响应式数据的值
      if (this.options.deep) {
        const valueType = type(value)
        // 某些情况下，最外层是非isObservable 对象，比如同时观察多个属性时
        if (!isObservable(value) && (valueType === 'Array' || valueType === 'Object')) {
          if (valueType === 'Array') {
            value = value.map(item => toJS(item, false))
          } else {
            const newValue = {}
            Object.keys(value).forEach(key => {
              newValue[key] = toJS(value[key], false)
            })
            value = newValue
          }
        } else {
          value = toJS(value, false)
        }
      } else if (isObservableArray(value)) {
        value.peek()
      } else if (isObservableObject(value)) {
        keys(value)
      }
    })
    return value
  }

  update () {
    if (this.options.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  run () {
    const immediateAsync = !this.hasOwnProperty('value')
    const oldValue = this.value
    this.value = this.getValue() // 重新获取新的 renderData 的值
    if (immediateAsync || this.value !== oldValue || isObject(this.value) || this.options.forceCallback) {
      if (this.callback) {
        immediateAsync ? this.callback(this.value) : this.callback(this.value, oldValue)
      }
    }
  }

  destroy () {
    this.destroyed = true
    this.reaction.getDisposer()()
  }
}
```

Watcher 观察者核心实现的工作流程就是：

1. 构建一个 Reaction 实例；
2. 调用 getValue 方法，即 reaction.track，在这个方法内部执行过程中会调用 renderFunction，这样在 renderFunction 方法的执行过程中便会访问到渲染所需要的响应式的数据并完成依赖收集；
3. 根据 immediateAsync 配置来决定回调是放到下一帧还是立即执行；
4. 当响应式数据发生变化的时候，执行 reaction 实例当中的回调函数，即`this.update()`方法来完成页面的重新渲染。

mpx 在构建这个响应式的系统当中，主要有2个大的环节，其一为在构建编译的过程中，将 template 模块转化为 renderFunction，提供了渲染模板时所需响应式数据的访问机制，并将 renderFunction 注入到运行时代码当中，其二就是在运行环节，mpx 通过构建一个小程序实例的代理对象，将小程序实例上的数据访问全部代理至 MPXProxy 实例上，而 MPXProxy 实例即 mpx 基于 Mobx 去构建的一套响应式数据对象，首先将 data 数据转化为响应式数据，其次提供了 computed 计算属性，watch 方法等一系列增强的拓展属性/方法，虽然在你的业务代码当中 page/component 实例 this 都是小程序提供的，但是最终经过代理机制，实际上访问的是 MPXProxy 所提供的增强功能，所以 mpx 也是通过这样一个代理对象去接管了小程序的实例。需要特别指出的是，mpx 将小程序官方提供的 setData 方法同样收敛至内部，这也是响应式系统提供的基础能力，即开发者只需要关注业务开发，而有关小程序渲染运行在 mpx 内部去帮你完成。

### 事件系统

## 性能优化

由于小程序的双线程的架构设计，逻辑层和视图层之间需要桥接 native bridge。如果要完成视图层的更新，那么逻辑层需要调用 setData 方法，数据经由 native bridge，再到渲染层，这个工程流程为：

> 小程序逻辑层调用宿主环境的 setData 方法；

> 逻辑层执行 JSON.stringify 将待传输数据转换成字符串并拼接到特定的JS脚本，并通过evaluateJavascript 执行脚本将数据传输到渲染层；

> 渲染层接收到后， WebView JS 线程会对脚本进行编译，得到待更新数据后进入渲染队列等待 WebView 线程空闲时进行页面渲染；

> WebView 线程开始执行渲染时，待更新数据会合并到视图层保留的原始 data 数据，并将新数据套用在WXML片段中得到新的虚拟节点树。经过新虚拟节点树与当前节点树的 diff 对比，将差异部分更新到UI视图。同时，将新的节点树替换旧节点树，用于下一次重渲染。

[文章来源](https://mp.weixin.qq.com/s?__biz=MjM5MTA1MjAxMQ==&mid=2651232791&idx=1&sn=4b83b66d376b1331a992d242cb2a0f17&chksm=bd4943938a3eca853a687765397517cc0ab9cfe4c711705e8fd821bbea8a1ab3c115c8c2fc65&scene=21#wechat_redirect)

而 setData 作为逻辑层和视图层之间通讯的核心接口，那么对于这个接口的使用遵照一些准则将有助于性能方面的提升。

### 尽可能的减少 setData 传输的数据

Mpx 在这个方面所做的工作之一就是基于数据路径的 diff。这也是官方所推荐的 setData 的方式。每次响应式数据发生了变化，调用 setData 方法的时候确保传递的数据都为 diff 过后的最小数据集，这样来减少 setData 传输的数据。

接下来我们就来看下这个优化手段的具体实现思路，首先还是从一个简单的 demo 来看：

```javascript
<script>
import { createComponent } from '@mpxjs/core'

createComponent({
  data: {
    obj: {
      a: {
        c: 1,
        d: 2
      }
    }
  }
  onShow() {
    setTimeout(() => {
      this.obj.a = {
        c: 1,
        d: 'd'
      }
    }, 200)
  }
})
</script>
```

在示例 demo 当中，声明了一个 obj 对象(这个对象里面的内容在模块当中被使用到了)。然后经过 200ms 后，手动修改 obj.a 的值，因为对于 c 字段来说它的值没有发生改变，而 d 字段发生了改变。因此在 setData 方法当中也应该只更新 obj.a.d 的值，即：

```javascript
this.setData('obj.a.d', 'd')
```

因为 mpx 是整体接管了小程序当中有关调用 setData 方法并驱动视图更新的机制。所以当你在改变某些数据的时候，mpx 会帮你完成数据的 diff 工作，以保证每次调用 setData 方法时，传入的是最小的更新数据集。

这里也简单的分析下 mpx 是如何去实现这样的功能的。在上文的编译构建阶段有分析到 mpx 生成的 Render Function，这个 Render Function 每次执行的时候会返回一个 renderData，而这个 renderData 即用以接下来进行 setData 驱动视图渲染的原始数据。renderData 的数据组织形式是模板当中使用到的数据路径作为 key 键值，对应的值使用一个数组组织，数组第一项为数据的访问路径(可获取到对应渲染数据)，第二项为数据路径的第一个键值，例如在 demo 示例当中的 renderData 数据如下：

```javascript
renderData['obj.a.c'] = [this.obj.a.c, 'obj']
renderData['obj.a.d'] = [this.obj.a.d, 'obj']
```

当页面第一次渲染，或者是响应式输出发生变化的时候，Render Function 都会被执行一次用以获取最新的 renderData 来进行接下来的页面渲染过程。

```javascript
// src/core/proxy.js

class MPXProxy {
  ...
  renderWithData(rawRenderData) { // rawRenderData 即为 Render Function 执行后获取的初始化 renderData
    const renderData = preprocessRenderData(rawRenderData) // renderData 数据的预处理
    if (!this.miniRenderData) { // 最小数据渲染集，页面/组件初次渲染的时候使用 miniRenderData 进行渲染，初次渲染的时候是没有数据需要进行 diff 的
      this.miniRenderData = {}
      for (let key in renderData) { // 遍历数据访问路径
        if (renderData.hasOwnProperty(key)) {
          let item = renderData[key] 
          let data = item[0]
          let firstKey = item[1] // 某个字段 path 的第一个 key 值
          if (this.localKeys.indexOf(firstKey) > -1) {
            this.miniRenderData[key] = diffAndCloneA(data).clone
          }
        }
      }
      this.doRender(this.miniRenderData)
    } else { // 非初次渲染使用 processRenderData 进行数据的处理，主要是需要进行数据的 diff 取值工作，并更新 miniRenderData 的值
      this.doRender(this.processRenderData(renderData))
    }
  }

  processRenderData(renderData) {
    let result = {}
    for (let key in renderData) {
      if (renderData.hasOwnProperty(key)) {
        let item = renderData[key]
        let data = item[0]
        let firstKey = item[1]
        let { clone, diff } = diffAndCloneA(data, this.miniRenderData[key]) // 开始数据 diff
        // firstKey 必须是为响应式数据的 key，且这个发生变化的 key 为 forceUpdateKey 或者是在 diff 阶段发现确实出现了 diff 的情况
        if (this.localKeys.indexOf(firstKey) > -1 && (this.checkInForceUpdateKeys(key) || diff)) {
          this.miniRenderData[key] = result[key] = clone
        }
      }
    }
    return result
  }
  ...
}

// src/helper/utils.js

// 如果 renderData 里面即包含对某个 key 的访问，同时还有对这个 key 的子节点访问的话，那么需要剔除这个子节点
/**
 * process renderData, remove sub node if visit parent node already
 * @param {Object} renderData
 * @return {Object} processedRenderData
 */
export function preprocessRenderData (renderData) { 
  // method for get key path array
  const processKeyPathMap = (keyPathMap) => {
    let keyPath = Object.keys(keyPathMap)
    return keyPath.filter((keyA) => {
      return keyPath.every((keyB) => {
        if (keyA.startsWith(keyB) && keyA !== keyB) {
          let nextChar = keyA[keyB.length]
          if (nextChar === '.' || nextChar === '[') {
            return false
          }
        }
        return true
      })
    })
  }

  const processedRenderData = {}
  const renderDataFinalKey = processKeyPathMap(renderData) // 获取最终需要被渲染的数据的 key
  Object.keys(renderData).forEach(item => {
    if (renderDataFinalKey.indexOf(item) > -1) {
      processedRenderData[item] = renderData[item]
    }
  })
  return processedRenderData
}
```

这里大致的描述下相关流程：



相关参阅文档：

* [Page](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#Page.prototype.setData(Object%20data,%20Function%20callback))

### 尽可能的减少 setData 的调用频次


