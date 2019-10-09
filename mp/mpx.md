# Mpx 小程序框架技术揭秘

与目前业内的几个小程序框架相比较而言，mpx 开发设计的出发点就是基于原生的小程序去做功能增强。所以从开发框架的角度来说，是没有任何“包袱”，围绕着原生小程序这个 core 去做不同功能的 patch 工作，使得开发小程序的体验更好。

于是我挑了一些我非常感兴趣的点去学习了下 mpx 在相关功能上的设计与实现。

## 编译

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

这样就可以看到 list.mpx 这个文件首先 selector(抽离`list.mpx`当中有关 json 的配置，并传入到 json-compiler 当中) --->>> json-compiler(对 json 配置进行处理，添加动态入口等) --->>> extractor(利用 child compiler 单独生成 json 配置文件)


### Render Function

### Wxs Module

## 运行时

