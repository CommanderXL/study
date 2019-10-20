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

### 响应式系统

### 基于数据路径的diff

### 数据更新

### 事件系统

