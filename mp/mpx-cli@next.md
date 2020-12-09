# mpx-cli@next 插件化改造

## 背景 & 现状

`@mpxjs/cli@2.x` 版本整体是基于模板配置的方式完成项目的初始化，整个的工作流是：

下载一份存放于远端的 mpx 项目原始模板（mpx-template） -> 根据用户的 prompts 选项完成用户选项的注入

完成项目的初始化后，除了一些基础配置文件外，整个项目的文件主要包含了如下的结构：

```javascript
-- mpx-cube-ui
 |-- src // 项目源码
 |-- config // 项目配置文件
   |-- dll.config.js
   |-- index.js
   |-- mpxLoader.conf.js // mpx-loader 配置
   |-- mpxPlugin.conf.js // mpx webpack-plugin 配置
   |-- user.conf.js // 用户的 prompts 选择信息
 |-- build // 编译构建配置
   |-- build.js
   |-- getPlugins.js
   |-- getRules.js
   |-- getWebpackConf.js
   |-- utils.js
   |-- webpack.base.conf.js
```

在初始化的项目当中，有关项目的所有配置文件，编译构建代码是全部暴露给开发者的，开发者可以对这些文件进行修改来满足自己实际的项目开发需要。同时还可以基于这一套原始的模板文件二次拓展为满足自己业务场景的模板。

基于远程模板初始化项目的方式最大的一个好处就是将项目所有的底层配置完全暴露给开发者，开发者可以任意去修改对应的配置。

但是这种大而全的方式会面临这样的一些问题：

1. 远程模板(mpx-template)如果有更新，对于用户来说没有一个很好的方式完成升级工作，基本只能通过 copy 代码的方式，将 `mpx-template` 更新后的内容复制一份到自己的项目当中；


## 解决方案

## 实现细节