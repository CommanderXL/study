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
  this.hooks.factory.tap('NormalModuleFactory', () => (result, callback) => { ... })

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

内联的 loader 统一会转化为：

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

