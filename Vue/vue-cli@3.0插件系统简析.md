# Vue-cli@3.0 插件系统简析

Vue cli@3.0 是一个全新的 Vue 项目脚手架。不同于 1.x/2.x 基于模板的脚手架，Vue cli@3.0 采用了一套基于插件的架构，它将部分核心功能收敛至 cli 内部，同时对开发者暴露可拓展的 API 已供开发者对 cli 的功能进行灵活的拓展和配置。接下来我们就通过 Vue cli@3.0 的源码来看下这套插件架构是如何设计的。

当你使用 `vue create <project-name>`创建一个新的 Vue 项目后，你会发现项目相较于之前的模板发生了很大的变化，

TODO：补一个项目的结构图

关于 webpack 相关的配置以及 npm script都没有在模板里面直接暴露出来，而是提供了新的 npm script:

```javascript
// package.json

"scripts": {
    "serve": "vue-cli-service serve",   
    "build": "vue-cli-service build",
    "lint": "vue-cli-service lint"
  },
```

前2个脚本命令是项目本地安装的 @vue/cli-serve 所提供的基于 webpack 及相关的插件进行封装的本地开发 + 本地构建的服务。@vue/cli-serve 将 webpack 及相关插件提供的功能都收敛到 @vue/cli-serve 内部来实现。这2个命令对应于 node_modules/@vue/cli-service/lib/commands 下的 serve.js 和 build/index.js 。

在 serve.js 和 build/index.js 的内部分别暴露了一个函数及一个 defaultModes 属性供外部来使用。**事实上这两者都是作为built-in（内部）插件来供 vue-cli-service 来使用的**。

说到这里那么就来看看 vue-cli-service 内部是如何搭建整个插件系统的。

在 lib/Service.js 内部定义了一个核心的类 Service，它作为 @vue/cli 的运行时的服务而存在。在执行`npm run serve`后，首先完成 Service 的初始化的工作：

```javascript
class Service {
    constructor(context) {
        ...
        this.webpackChainFns = []  // 数组内部每项为一个fn
        this.webpackRawConfigFns = []  // 数组内部每项为一个fn 或 webpack 对象字面量配置项
        this.devServerConfigFns = []
        this.commands = {}  // cli 命令
        
        ...
        this.plugins = this.resolvePlugins(plugins, useBuiltIn)
        ...
    }
}
```

在初始化 Service 实例的过程当中会完成插件的加载工作：

```javascript
 resolvePlugins(inlinePlugins, useBuiltIn) {
    const idToPlugin = id => ({
      id: id.replace(/^.\//, 'built-in:'),
      apply: require(id)
    })

    let plugins
    
    // @vue/cli-service内部提供的插件
    const builtInPlugins = [
      './commands/serve',
      './commands/build',
      './commands/inspect',
      './commands/help',
      // config plugins are order sensitive
      './config/base',
      './config/css',
      './config/dev',
      './config/prod',
      './config/app'
    ].map(idToPlugin)

    if (inlinePlugins) {
      plugins = useBuiltIn !== false
        ? builtInPlugins.concat(inlinePlugins)
        : inlinePlugins
    } else {
      // 加载项目当中使用的插件
      const projectPlugins = Object.keys(this.pkg.devDependencies || {})
        .concat(Object.keys(this.pkg.dependencies || {}))
        .filter(isPlugin)
        .map(idToPlugin)
      plugins = builtInPlugins.concat(projectPlugins)
    }

    // Local plugins
    if (this.pkg.vuePlugins && this.pkg.vuePlugins.service) {
      const files = this.pkg.vuePlugins.service
      if (!Array.isArray(files)) {
        throw new Error(`Invalid type for option 'vuePlugins.service', expected 'array' but got ${typeof files}.`)
      }
      plugins = plugins.concat(files.map(file => ({
        id: `local:${file}`,
        apply: loadModule(file, this.pkgContext)
      })))
    }

    return plugins
 }
```

在这个 resolvePlugins 方法当中，主要完成了对于 @vue/cli-service 内部提供的插件以及项目应用(package.json)当中需要使用的插件的加载，并将对应的插件进行缓存。我们注意到 builtInPlugins 主要分为了2类，一类为：

```javascript
'./commands/serve'
'./commands/build'
'./commands/inspect'
'./commands/help'
```

这一类插件在内部通过注册的方式去初始化一个新的 cli 命令，并对外暴露提供给开发者进行使用。例如在 ./commands/serve 内部，首先通过 API 的形式去注册 `vue-cli-service serve`本地开发服务：

```javascript
module.exports = (api, options) => {
    api.registerCommand('serve', {
        description: 'start development server',
        usage: 'vue-cli-service serve [options] [entry]',
        options: {
          '--open': `open browser on server start`,
          '--copy': `copy url to clipboard on server start`,
          '--mode': `specify env mode (default: development)`,
          '--host': `specify host (default: ${defaults.host})`,
          '--port': `specify port (default: ${defaults.port})`,
          '--https': `use https (default: ${defaults.https})`,
          '--public': `specify the public network URL for the HMR client`
        }
    }, async function serve(args) {
        // do something
    })
}
```

插件对外暴露一个函数，接收到的一个参数 api 提供了 cli 命令的注册的功能。

除了上述提到的几种提供 cli 命令注册的插件外，还有一类插件为：

```javascript
'./config/base'
'./config/css'
'./config/dev'
'./config/prod'
'./config/app'
```

这一类插件主要是完成 webpack 本地编译构建时的各种相关的配置，和提供 cli 命令注册的插件一样，webpack 配置插件同样向外暴露一个函数，接收到的第一个参数 api 提供了 chainWebpack 方法来完成 webpack 的相关配置。例如在 ./config/base 内部，完成了 webpack 的基本配置内容，例如 entry、output、加载不同文件类型的 loader 的配置：

```javascript
module.exports = (api, options) => {
    api.chainWebpack(webpackConfig => {
        webpackConfig.module
          .rule('vue')
            .test(/\.vue$/)
            .use('cache-loader')
              .loader('cache-loader')
              .options(vueLoaderCacheConfig)
              .end()
            .use('vue-loader')
              .loader('vue-loader')
              .options(Object.assign({
                compilerOptions: {
                  preserveWhitespace: false
                }
              }, vueLoaderCacheConfig))
    })
}

// 有关 webpack 其他相关的配置请参照对应的源码
```

**不同于之前使用的配置式的 webpack 使用方式，在 @vue/cli-service 所使用的所有插件当中(不管是内置还是其他开发者所提供的)，都使用的是 API 式的 webpack 使用方式**。这种方式也使得 webpack 的配置更加的灵活，当你的项目迁移至 @vue/cli@3.0 ，使用的 webpack 插件也必须要使用 API 式的配置，同时插件不仅仅要提供插件自身的功能，同时也需要帮助调用方完成插件的注册等工作。

在上面提到的关于插件统一的格式都是向外暴露一个函数，接收的第一个参数为`api`，它是由 PluginAPI.js 实例化产生的：

```javascript
class PluginAPI {
  constructor (id, service) {
    this.id = id            // 对应这个插件名
    this.service = service  // 对应 Service 类的实例(单例)
  }
  ...
  registerCommand (name, opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = null
    }
    this.service.commands[name] = { fn, opts: opts || {}}
  }
  chainWebpack (fn) {
    this.service.webpackChainFns.push(fn)
  }
  ...
}
```

每一个插件在被调用的过程中，都会接收一个新的 PluginAPI 实例，这个 api 实例提供了：

* 注册 cli 命令服务(api.registerCommand)
* 变更 webpack 配置(api.chainWebpack)
* resolve wepack 配置(api.resolveWebpackConfig)
* ...

当 Service 实例化完成后，调用实例上的`run`方法来启动对应的 cli 命令所提供的服务。


以上介绍了 @vue/cli-service 插件系统当中几个核心的模块，即：Service.js 提供核心的

以上就是 @vue/cli-service 插件工作流。

