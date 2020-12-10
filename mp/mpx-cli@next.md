# mpx-cli@next 插件化改造

## 背景 & 现状

`@mpxjs/cli@2.x` 版本整体是基于模板配置的方式完成项目的初始化，整个的工作流是：

下载一份存放于远端的 mpx 项目原始模板（mpx-template） -> 根据用户的 prompts 选项完成用户选项的注入

完成项目的初始化后，除了一些基础配置文件外，整个项目的文件主要包含了如下的结构：

```javascript
-- mpx-project
 |-- src // 项目源码
 |-- config // 项目配置文件
   |-- dll.config.js // dll 配置
   |-- index.js // 配置入口文件
   |-- mpxLoader.conf.js // mpx-loader 配置
   |-- mpxPlugin.conf.js // mpx webpack-plugin 配置
   |-- user.conf.js // 用户的 prompts 选择信息
 |-- build // 编译构建配置
   |-- build.js // 构建编译脚本
   |-- getPlugins.js // webpack plugins 
   |-- getRules.js // webpack module rules
   |-- getWebpackConf.js // webpack 配置生成辅助函数
   |-- utils.js // 工具函数
   |-- webpack.base.conf.js // webpack 基础配置
```

在初始化的项目当中，有关项目的所有配置文件，编译构建代码是全部暴露给开发者的，开发者可以对这些文件进行修改来满足自己实际的项目开发需要。同时还可以基于这一套原始的模板文件二次拓展为满足自己业务场景的模板。

基于远程模板初始化项目的方式最大的一个好处就是将项目所有的底层配置完全暴露给开发者，开发者可以任意去修改对应的配置。

但是目前 `@mpxjs/cli@2.x` 采用这种基于模板的方式面临着这样的一些问题：

1. 对于 `@mpxjs/cli` 的用户而言：

*  如果远程模板的维护者如果对远程模板(mpx-template)进行了更新，对于用户来说没有一个很好的方式完成升级工作，基本只能通过 copy 代码的方式，将 `mpx-template` 更新后的内容复制一份到自己的项目当中；

* `@mpxjs/cli` 提供的是大而全的能力，从项目结构角度来说没法做到按需。例如我需要开发一个小程序，但是像 `dll` 这种增强的功能或者是没有使用到的小程序插件的构建配置都会出现在生成项目当中(虽然通过一些配置在构建过程中关闭了这些功能)。那么用户在进行编译打包构建配置的时候需要花些时间去理解整个配置的生成过程，来决定到底需要在哪里进行改造。


2. 对于 `@mpxjs/cli` 的开发者而言：

* 分支场景多，功能模块耦合度高：脚手架的所有功能全部集合到一个大的模板当中。各部分的能力都是耦合在一起，为了满足不同项目的实际开发需要，代码里面需要写比较多的 `if...else...` 判断逻辑来决定要开启哪些功能。


## 解决方案

`vue` 在2年前发布了 `@vue/cli@3.x`。和 `2.x` 版本相比而言，整个 `@vue/cli` 的架构发生了非常大的变化，从基于模板的脚手架迭代为基于插件化的脚手架。简单的概述下整个的构架就是：

一个 `vue-cli-plugin` 核心主要包含了2部分的内容：

* `generator` 模板生成器

* `webpack` 编译构建配置

TODO: `@vue/cli` 设计的执行规范

## 改造细节

### 模块拆分

从跨平台的角度出发：

1. web 开发

2. 小程序开发

* 基于 `wx` 的跨平台(`ali`、`swan`，`tt`)的小程序开发；
* 使用云函数的微信小程序开发；
* 微信小程序的插件模式的开发；

公共能力：`dll`

基本上面提到的所有开发模式都对应了

1. **不同的目录结构**；

2. **不同的编译构建配置**

基于这样一种现状以及 `@mpxjs/cli` 所要解决的问题，从跨平台的角度出发将功能进行了拆分，最终拆解为如下的9个插件：

* vue-cli-plugin-mpx

* vue-cli-plugin-mpx-mp

* vue-cli-plugin-mpx-web

* vue-cli-plugin-mpx-cloud-func

* vue-cli-plugin-mpx-plugin-mode

* vue-cli-plugin-mpx-eslint

* vue-cli-plugin-mpx-unit-test

* vue-cli-plugin-mpx-typescript

* vue-cli-plugin-mpx-dll

这些拆解出来的插件都将和功能相关的**项目模板**以及**编译构建**配置进行了收敛。

项目模板的生成不用说，借助 `@vue/cli` 的 `Generator API` 按需去生成项目开发所需要的模板，例如项目需要使用 `eslint` 的功能，那么在生成项目的时候会生成对应 `vue-cli-plugin-mpx-eslint` 所提供的模板文件，如果不需要使用，项目当中最终也不会出现和 `eslint` 相关的文件配置。

重点说下编译构建的配置是如何进行拆解的：

**在 `@vue/cli@3.x` 基于插件的架构设计当中，决定是否要使用某个插件的依据就是判断这个插件是否被你的项目所安装**和基于模板的构架相比最大的区别就是：基于模板的架构在最终生成的模板配置里需要保存一些环境配置文件，以供编译构建的运行时来判断是否启用某些功能。但是基于插件的架构基本上是不再需要这些环境配置文件的，因为你如果要使用一个插件的功能，只需要安装它即可。

因此依照这样的设计规范，我们将：

* `eslint`

* `unit-test`

* `typescript`

* `dll` 

这些非常独立的功能都单独抽离成了可拔插的插件，安装即启用。

以上功能有个特点就是和平台是完全解耦的，所以在拆解的过程中可以拆的比较彻底。但是由于 `mpx` 项目的特殊性，即要支持基于 `wx` 小程序的跨端以及 `web` 开发，同时还要支持小程序的云函数、小程序插件模式的开发，且不同开发模式的编译构建配置都有些差异。可以用如下的集合图来表示他们之间的关系：

TODO：补一个集合的图

在不同平台开发模式下是有 `mpx` 编译构建的基础配置的，这个是和平台没有太多关系，因此将这部分的配置单独抽离为一个插件：`vue-cli-plugin-mpx`，**同时这个插件也被置为了 `@mpxjs/cli` 的 `preset` 预设插件，不管任何项目开发模式下，这个插件都会被默认的安装**。

```javascript
// vue-cli-plugin-mpx
module.exports = function (api, options, webpackConfig) {
  webpackConfig.module
    .rule('json')
    .test(/\.json$/)
    .resourceQuery(/__component/)
    .type('javascript/auto')

  webpackConfig.module
    .rule('wxs-pre-loader')
    .test(/\.(wxs|qs|sjs|filter\.js)$/)
    .pre()
    .use('mpx-wxs-pre-loader')
    .loader(MpxWebpackPlugin.wxsPreLoader().loader)

  webpackConfig.module.rules.delete('images')
  const mpxUrlLoader = MpxWebpackPlugin.urlLoader({
    name: 'img/[name][hash].[ext]'
  })
  webpackConfig.module
    .rule('images')
    .test(/\.(png|jpe?g|gif|svg)$/)
    .use('mpx-url-loader')
    .loader(mpxUrlLoader.loader)
    .options(mpxUrlLoader.options)

  const transpileDepRegex = genTranspileDepRegex(options.transpileDependencies)
  webpackConfig.module
    .rule('js')
    .test(/\.js$/)
    .include
      .add(filepath => transpileDepRegex && transpileDepRegex.test(filepath))
      .add(api.resolve('src'))
      .add(api.resolve('node_modules/@mpxjs'))
      .add(api.resolve('test'))
        .end()
    .use('babel-loader')
      .loader('babel-loader')

  webpackConfig.resolve.extensions
    .add('.mpx')
    .add('.wxml')
    .add('.ts')
    .add('.js')

  webpackConfig.resolve.modules.add('node_modules')
}
```


### @vue/cli 能力复用

在 `@mpxjs/cli@2.x` 版本当中有关 `web` 侧的编译构建的配置是比较初级的。目前像 `热更新`、`MPA 多页应用` 等比较常用的功能暂时没有提供。而 `@vue/cli@3.x` 即为 `vue` 项目而生，提供了非常完备的 `web` 应用的编译构建打包配置。

**所以 `@mpxjs/cli@next` 版本里面做了一项非常重要的工作就是复用 `@vue/cli` 的能力，弥补 `mpx` 项目在跨 `web` 项目编译构建的不足。**

因此关于 `mpx` 跨 `web` 编译构建的部分也单独抽离为一个插件：`vue-cli-plugin-mpx-web`，这个插件所做的工作就是在 `@vue/cli` 提供的 `web` 编译构建的能力上去适配 `mpx` 项目。这样也就完成了 `mpx` 跨 `web` 项目编译构建能力的增强。

## 没有银弹

虽然基于 `@vue/cli` 插件的架构模式完成了 `@mpxjs/cli@next` 的插件化改造升级。但是由于 `mpx` 项目开发的一些特殊性，不同插件之间的协同工作是有一些约定的。

例如 `@vue/cli-service` 内置了一些 `webpack` 的配置，因为 `@vue/cli` 是专门针对 `web`应用的，这些配置会在所有的编译构建流程当中生效，不过这些配置当中有些对于小程序的开发来说是不需要的。

那么针对这种情况，为了避免不同模式下的 `webpack` 配置相互污染。`web` 侧的编译构建还是基于 `@vue/cli` 提供的能力去适配 `mpx` 的 `web` 开发。而小程序侧的编译构建配置是通过 `@vue/cli-service` 内部暴露出来的一些方法去跳过一些对于小程序开发来说不需要的 `webpack` 配置来最终满足小程序的构建配置。