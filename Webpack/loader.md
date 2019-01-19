提纲：

1. loader 的配置
2. loader 的匹配
3. loader 的解析
4. loader 的执行
5. loader 的实践

## Webpack loader 详解


### loader 的配置

Webpack 对于一个 module 所使用的 loader 对开发者提供了2种使用方式：

1. webpack config 配置形式，形如：

```javascript
// webpack.config.js
module.exports = {
  ...
  module: {
    rules: [{
      test: /.vue$/,
      loader: 'vue-loader'
    }, {
      test: /.scss$/,
      use: [
        'vue-style-loader',
        'css-loader',
        {
          loader: 'sass-loader',
          options: {
            data: '$color: red;'
          }
        }
      ]
    }]
  }
  ...
}
```

2. inline 内联形式

```javascript
// module

import a from 'raw-loader!../../utils.js'
```

### loader 的匹配

在讲 loader 的匹配过程之前，首先从整体上了解下 loader 在整个 webpack 的 workflow 过程中出现的时机。

// TODO: 补一张执行的流程图

可以看到在一个 module 构建过程中，首先根据 module 的依赖类型(例如 normalModuleFactory)调用对应的构造函数来创建对应的模块。在创建模块的过程中，会根据开发者的 webpack.config 当中的 rules 以及 webpack 内置的 rules 规则实例化 ruleset 匹配实例，这个 ruleset 实例在 loader 的匹配过滤过程中非常的关键，具体的源码解析可参见[Webpack Loader Ruleset 匹配规则解析](https://github.com/CommanderXL/Biu-blog/issues/30)。此外还会注册2个钩子函数:

```javascript
class NormalModuleFactory {
  ...
  // 内部嵌套 resolver 的钩子，完成相关的解析后，创建这个 module
  this.hooks.factory.tap('NormalModuleFactory', () => (result, callback) => { ... })

  // 在 hooks.factory 的钩子内部进行调用，实际的作用为解析构建一共 module 所需要的 loaders 及这个 module 的相关构建信息(例如获取 module 的 packge.json等)
  this.hooks.resolver.tap('NormalModuleFactory', () => (result, callback) => { ... })
  ...
}
```


...


接下来就调用 resolver 钩子(`hooks.resolver`)进入到了 resolve 的阶段，在真正开始 resolve loader 之前，首先就是需要匹配过滤找到构建这个 module 所需要使用的所有的 loaders。首先进行的是对于 inline loaders 的处理：

```javascript
// NormalModuleFactory.js

// 是否忽略 preLoader 以及 normalLoader
const noPreAutoLoaders = requestWithoutMatchResource.startsWith("-!");
// 是否忽略 normalLoader
const noAutoLoaders =
  noPreAutoLoaders || requestWithoutMatchResource.startsWith("!");
// 忽略所有的 preLoader / normalLoader / postLoader
const noPrePostAutoLoaders = requestWithoutMatchResource.startsWith("!!");

// 首先解析出所需要的 loader，这种 loader 为内联的 loader
let elements = requestWithoutMatchResource
  .replace(/^-?!+/, "")
  .replace(/!!+/g, "!")
  .split("!");
let resource = elements.pop(); // 获取资源的路径
elements = elements.map(identToLoaderRequest); // 获取每个loader及对应的options配置（将inline loader的写法变更为module.rule的写法）
```

首先是根据模块的路径规则，例如，`-!` / `!` / `!!` 来判断这个模块是否只是使用 inline loader，或者剔除掉 pre，post loader 等规则，具体的作用在下文会讲到。然后会将所有的 inline loader 转化为数组的形式，例如：

```javascript
import 'style-loader!css-loader!stylus-loader?a=b!../../common.styl'
```

内联的 loader 统一格式输出为：

```javascript
[{
  loader: 'style-loader',
  options: undefined
}, {
  loader: 'css-lodaer',
  options: undefined
}, {
  loader: 'stylus-loader',
  options: '?a=b'
}]

```

对于内联的 loader 的处理便是直接对其进行 resolve，获取对应 loader 的相关信息：

```javascript
asyncLib.parallel([
  callback => 
    this.resolveRequestArray(
      contextInfo,
      context,
      elements,
      loaderResolver,
      callback
    ),
  callback => {
    // 对这个 module 进行 resolve
    ...
    callack(null, {
      resouceResolveData, // 模块的基础信息，包含 descriptionFilePath / descriptionFileData 等(即 package.json 等信息)
      resource // 模块的绝对路径
    })
  }
], (err, results) => {
  const loaders = results[0] // 所有内联的 loaders
  const resourceResolveData = results[1].resourceResolveData; // 获取模块的基本信息
  resource = results[1].resource; // 模块的绝对路径
  ...
  
  // 接下来就要开始根据引入模块的路径开始匹配对应的 loaders
  let resourcePath =
    matchResource !== undefined ? matchResource : resource;
  let resourceQuery = "";
  const queryIndex = resourcePath.indexOf("?");
  if (queryIndex >= 0) {
    resourceQuery = resourcePath.substr(queryIndex);
    resourcePath = resourcePath.substr(0, queryIndex);
  }
  // 获取符合条件配置的 loader
  const result = this.ruleSet.exec({
    resource: resourcePath, // module 的绝对路径
    realResource:
      matchResource !== undefined
        ? resource.replace(/\?.*/, "")
        : resourcePath,
    resourceQuery, // module 路径上所带的 query 参数
    issuer: contextInfo.issuer, // 所解析的 module 的发布者
    compiler: contextInfo.compiler 
  });
})
```
