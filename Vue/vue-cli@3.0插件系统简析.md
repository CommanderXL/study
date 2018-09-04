# Vue-cli@3.0 插件系统简析

Vue-cli@3.0 是一个全新的 Vue 项目脚手架。不同于 1.x/2.x 基于模板的脚手架，Vue-cli@3.0 采用了一套基于插件的架构，它将部分核心功能收敛至 CLI 内部，同时对开发者暴露可拓展的 API 已供开发者对 CLI 的功能进行灵活的拓展和配置。接下来我们就通过 Vue-cli@3.0 的源码来看下这套插件架构是如何设计的。

整个插件系统当中包含2个重要的组成部分：

* @vue/cli，提供 cli 命令服务，例如`vue create`创建一个新的项目；
* @vue/cli-service，提供了本地开发构建服务。

## @vue/cli-service

当你使用 `vue create <project-name>`创建一个新的 Vue 项目后，你会发现项目相较于之前的模板发生了很大的变化，其中关于 webpack 相关的配置以及 npm script 都没有在模板里面直接暴露出来，而是提供了新的 npm script:

```javascript
// package.json
"scripts": {
  "serve": "vue-cli-service serve",
  "build": "vue-cli-service build",
  "lint": "vue-cli-service lint"
}
```

前 2 个脚本命令是项目本地安装的 @vue/cli-service 所提供的基于 webpack 及相关的插件进行封装的本地开发/构建的服务。@vue/cli-service 将 webpack 及相关插件提供的功能都收敛到 @vue/cli-service 内部来实现。

这 2 个命令对应于 node_modules/@vue/cli-service/lib/commands 下的 serve.js 和 build/index.js。

在 serve.js 和 build/index.js 的内部分别暴露了一个函数及一个 defaultModes 属性供外部来使用。**事实上这两者都是作为 built-in（内置）插件来供 vue-cli-service 来使用的**。

说到这里那么就来看看 @vue/cli-service 内部是如何搭建整个插件系统的。就拿执行`npm run serve`启动本地开发服务来说，首先来看下 @vue/cli-service 提供的 cli 启动入口服务(@vue/cli-service/bin/vue-cli-service.js)：

> TODO: 插入流程图

```javascript
#!/usr/bin/env node

const semver = require('semver')
const { error } = require('@vue/cli-shared-utils')

const Service = require('../lib/Service')   // 引入 Service 基类
const service = new Service(process.env.VUE_CLI_CONTEXT || process.cwd())   // 实例化 service

const rawArgv = process.argv.slice(2)
const args = require('minimist')(rawArgv)
const command = args._[0]

service.run(command, args, rawArgv).catch(err => {  // 开始执行对应的 service 服务
  error(err)
  process.exit(1)
})
```

看到这里你会发现在 bin 里面并未提供和本地开发 serve 相关的服务，事实上在项目当中本地安装的 @vue/cli-service 提供的不管是内置的还是插件提供的服务都是动态的去完成相关 CLI 服务的注册。

在 lib/Service.js 内部定义了一个核心的类 Service，它作为 @vue/cli 的运行时的服务而存在。在执行`npm run serve`后，首先完成 Service 的实例化工作：


```javascript
class Service {
  constructor(context) {
    ...
    this.webpackChainFns = []  // 数组内部每项为一个fn
    this.webpackRawConfigFns = []  // 数组内部每项为一个 fn 或 webpack 对象字面量配置项
    this.devServerConfigFns = []
    this.commands = {}  // 缓存动态注册 CLI 命令

    ...
    this.plugins = this.resolvePlugins(plugins, useBuiltIn)   // 完成插件的加载
    this.modes = this.plugins.reduce((modes, { apply: { defaultModes }}) => {   // 缓存不同 CLI 命令执行时所对应的mode值
      return Object.assign(modes, defaultModes)
    }, {})   
  }
}
```

在实例化 Service 的过程当中完成了两个比较重要的工作：

- 加载插件
- 将插件提供的不同命令服务所使用的 mode 进行缓存

当 Service 实例化完成后，调用实例上的 `run` 方法来启动对应的 CLI 命令所提供的服务。

```javascript
async run (name, args = {}, rawArgv = []) {
  const mode = args.mode || (name === 'build' && args.watch ? 'development' : this.modes[name])

  // load env variables, load user config, apply plugins
  // 执行所有被加载进来的插件
  this.init(mode)

  ...
  const { fn } = command
  return fn(args, rawArgv)  // 开始执行对应的 cli 命令服务
}

init (mode = process.env.VUE_CLI_MODE) {
  ...
  // 执行plugins
  // apply plugins.
  this.plugins.forEach(({ id, apply }) => {
    // 传入一个实例化的PluginAPI实例，插件名作为插件的id标识，在插件内部完成注册 cli 命令服务和 webpack 配置的更新的工作
    apply(new PluginAPI(id, this), this.projectOptions)
  })

  ...
  // apply webpack configs from project config file
  if (this.projectOptions.chainWebpack) {
    this.webpackChainFns.push(this.projectOptions.chainWebpack)
  }
  if (this.projectOptions.configureWebpack) {
    this.webpackRawConfigFns.push(this.projectOptions.configureWebpack)
  }
}
```

接下来我们先看下 @vue/cli-service 当中的 Service 实例化的过程：通过 resolvePlugins 方法去完成插件的加载工作：

```javascript
 resolvePlugins(inlinePlugins, useBuiltIn) {
    const idToPlugin = id => ({
      id: id.replace(/^.\//, 'built-in:'),
      apply: require(id)    // 加载对应的插件
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

在这个 resolvePlugins 方法当中，主要完成了对于 @vue/cli-service 内部提供的插件以及项目应用(package.json)当中需要使用的插件的加载，并将对应的插件进行缓存。在其提供的内部插件当中又分为两类：

```javascript
'./commands/serve'
'./commands/build'
'./commands/inspect'
'./commands/help'
```

这一类插件在内部动态注册新的 CLI 命令，开发者即可通过 npm script 的形式去启动对应的 CLI 命令服务。

```javascript
'./config/base'
'./config/css'
'./config/dev'
'./config/prod'
'./config/app'
```

这一类插件主要是完成 webpack 本地编译构建时的各种相关的配置。@vue/cli-service 将 webpack 的开发构建功能收敛到内部来完成。

插件加载完成，开始调用 `service.run` 方法，在这个方法内部开始执行所有被加载的插件：

```javascript
this.plugins.forEach(({ id, apply }) => {
    apply(new PluginAPI(id, this), this.projectOptions)
  })
```

在每个插件执行的过程中，接收到的第一个参数都是 PluginAPI 的实例，PluginAPI 也是整个 @vue/cli-service 服务当中一个核心的基类：

```javascript
class PluginAPI {
  constructor (id, service) {
    this.id = id            // 对应这个插件名
    this.service = service  // 对应 Service 类的实例(单例)
  }
  ...
  registerCommand (name, opts, fn) {  // 注册自定义 cli 命令
    if (typeof opts === 'function') {
      fn = opts
      opts = null
    }
    this.service.commands[name] = { fn, opts: opts || {}}
  }
  chainWebpack (fn) {     // 缓存变更的 webpack 配置
    this.service.webpackChainFns.push(fn)
  }
  configureWebpack (fn) {   // 缓存变更的 webpack 配置
    this.service.webpackRawConfigFns.push(fn)
  }
  ...
}
```

每个由 PluginAPI 实例化的 api 实例都提供了：

- 注册 cli 命令服务(`api.registerCommand`)
- 通过 api 形式去更新的 webpack 配置(`api.chainWebpack`)
- 通过 raw 配置形式去更新的 webpack 配置(`api.configureWebpack`)，与`api.chainWebpack`提供的链式 api 操作 webpack 配置的方式不同，`api.configureWebpack`可接受raw式的配置形式，并通过 webpack-merge 对 webpack 配置进行合并。
- resolve wepack 配置(`api.resolveWebpackConfig`)，调用之前通过 chainWebpack 和 configureWebpack 上完成的对于 webpack 配置的改造，并生成最终的 webpack 配置
- ...

首先我们来看下 @vue/cli-service 提供的关于动态注册 CLI 服务的插件，拿 serve 服务(`./commands/serve`)来说：

```javascript
// commands/serve
module.exports = (api, options) => {
  api.registerCommand(
    'serve',
    {
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
    },
    async function serve(args) {
      // do something
    }
  )
}
```

`./commands/serve` 对外暴露一个函数，接收到的第一个参数 PluginAPI 的实例 api，并通过 api 提供的 registerCommand 方法来完成 CLI 命令(即 serve 服务)的注册。

再来看下 @vue/cli-service 内部提供的关于 webpack 配置的插件(`./config/base`)：

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
      .options(
        Object.assign(
          {
            compilerOptions: {
              preserveWhitespace: false
            }
          },
          vueLoaderCacheConfig
        )
      )
  })
}
```

这个插件完成了 webpack 的基本配置内容，例如 entry、output、加载不同文件类型的 loader 的配置。**不同于之前使用的配置式的 webpack 使用方式，@vue/cli-service 默认使用 webpack-chain([链接请戳我](https://github.com/mozilla-neutrino/webpack-chain)) 来完成 webpack 配置的修改**。这种方式也使得 webpack 的配置更加灵活，当你的项目迁移至 @vue/cli@3.0，使用的 webpack 插件也必须要使用 API 式的配置，同时插件不仅仅要提供插件自身的功能，同时也需要帮助调用方完成插件的注册等工作。

@vue/cli-service 将基于 webpack 的本地开发构建配置收敛至内部来实现，当你没有特殊的开发构建需求的时候，内部配置可以开箱即用，不用开发者去关心一些细节。当然在实际团队开发当中，内部配置肯定是无法满足的，得益于 @vue-cli@3.0 的插件构建设计，开发者不需要将内部的配置进行 Eject，而是直接使用 @vue/cli-service 暴露出来的 API 去完成对于特殊的开发构建需求。

以上介绍了 @vue/cli-service 插件系统当中几个核心的模块，即：

Service.js 提供服务的基类，它提供了 @vue/cli 生态当中本地开发构建时：插件加载(包括内部插件和项目应用插件)、插件的初始化，它的单例被所有的插件所共享，插件使用它的单例去完成 webpack 的更新。

PluginAPI.js 提供供插件使用的对象接口，它和插件是一一对应的关系。所有供 @vue/cli-service 使用的本地开发构建的插件接收的第一个参数都是 PluginAPI 的实例（`api`），插件使用这个实例去完成 CLI 命令的注册及对应服务的执行、webpack 配置的更新等。

以上就是 @vue/cli-service 插件系统简单的分析，感兴趣的同学可以深入阅读相关源码([链接请戳我](https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-service))进行学习。

## @vue/cli

不同于之前 1.x/2.x 的 vue-cli 工具都是基于远程模板去完成项目的初始化的工作，它属于那种大而全的方式，当你需要完成自定义的脚手架工具时，你可能要对 vue-cli 进行源码级别的改造，或者是在远程模板里面帮开发者将所有的配置文件初始化完成好。而 @vue/cli@3.0 主要是基于插件的 generator 去完成项目的初始化的工作，它将原来的大而全的模板拆解为现在基于插件系统的工作方式，每个插件完成自己所要对于项目应用的模板拓展工作。

@vue/cli 提供了终端里面的 vue 命令，例如：

- `vue create <project>` 创建一个新的 vue 项目
- `vue ui` 打开 vue-cli 的可视化配置
- ...

当你需要对 vue-cli 进行改造，自定义符合自己开发要求的脚手架的时候，那么你需要通过**开发 vue-cli 插件来对 vue-cli 提供的服务进行拓展来满足相关的要求**。vue-cli 插件始终包含一个 Service 插件作为其主要导出，且可选的包含一个 Generator 和一个 Prompt 文件。这里不细讲如何去开发一个 vue-cli 插件了，大家感兴趣的可以阅读[vue-cli-plugin-eslint](https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-eslint)

这里主要是来看下 vue-cli 是如何设计整个插件系统以及整个插件系统是如何工作的。

@vue/cli@3.0 提供的插件安装方式为一个 cli 服务：`vue add <plugin>`：

> install a plugin and invoke its generator in an already created project

执行这条命令后，@vue/cli 会帮你完成插件的下载，安装以及执行插件所提供的 generator。整个流程的执行顺序可通过如下的流程图去概括：

TODO: 插入流程图

我们来看下具体的代码逻辑：

```javascript
// @vue/cli/lib/add.js

async function add (pluginName, options = {}, context = process.cwd()) {

  ...

  const packageManager = loadOptions().packageManager || (hasProjectYarn(context) ? 'yarn' : 'npm')
  // 开始安装这个插件
  await installPackage(context, packageManager, null, packageName)

  log(`${chalk.green('✔')}  Successfully installed plugin: ${chalk.cyan(packageName)}`)
  log()

  // 判断插件是否提供了 generator 
  const generatorPath = resolveModule(`${packageName}/generator`, context)
  if (generatorPath) {
    invoke(pluginName, options, context)
  } else {
    log(`Plugin ${packageName} does not have a generator to invoke`)
  }
}
```
首先 cli 内部会安装这个插件，并判断这个插件是否提供了 generator，若提供了那么去执行对应的 generator。

```javascript
// @vue/cli/lib/invoke.js

async function invoke (pluginName, options = {}, context = process.cwd()) {
  const pkg = getPkg(context)

  ...
  // 从项目应用package.json中获取插件名
  const id = findPlugin(pkg.devDependencies) || findPlugin(pkg.dependencies)

  ...

  // 加载对应插件提供的generator方法
  const pluginGenerator = loadModule(`${id}/generator`, context)

  ...
  const plugin = {
    id,
    apply: pluginGenerator,
    options
  }

  // 开始执行generator方法
  await runGenerator(context, plugin, pkg)
}

async function runGenerator (context, plugin, pkg = getPkg(context)) {
  ...
  // 实例化一个Generator实例
  const generator = new Generator(context, {
    pkg
    plugins: [plugin],    // 插件提供的generator方法
    files: await readFiles(context),  // 将项目当中的文件读取为字符串的形式保存到内存当中，被读取的文件规则具体见readFiles方法
    completeCbs: createCompleteCbs,
    invoking: true
  })

  ...
  // resolveFiles 将内存当中的所有缓存的 files 输出到文件当中
  await generator.generate({
    extractConfigFiles: true,
    checkExisting: true
  })
}
```

和 @vue/cli-service 类似，在 @vue/cli 内部也有一个核心的类`Generator`，每个`@vue/cli`的插件对应一个`Generator`的实例。在实例化`Generator`方法的过程当中，完成插件提供的 generator 的执行。

```javascript
// @vue/cli/lib/Generator.js

module.exports = class Generator {
  constructor (context, {
    pkg = {},
    plugins = [],
    completeCbs = [],
    files = {},
    invoking = false
  } = {}) {
    this.context = context
    this.plugins = plugins
    this.originalPkg = pkg
    this.pkg = Object.assign({}, pkg)
    this.imports = {}
    this.rootOptions = {}
    ...
    this.invoking = invoking
    // for conflict resolution
    this.depSources = {}
    // virtual file tree
    this.files = files
    this.fileMiddlewares = []
    this.postProcessFilesCbs = []

    ...
    const cliService = plugins.find(p => p.id === '@vue/cli-service')
    const rootOptions = cliService
      ? cliService.options
      : inferRootOptions(pkg)
    // apply generators from plugins
    // 每个插件对应生成一个 GeneratorAPI 实例，并将实例 api 传入插件暴露出来的 generator 函数
    plugins.forEach(({ id, apply, options }) => {
      const api = new GeneratorAPI(id, this, options, rootOptions)
      apply(api, options, rootOptions, invoking)
    })
  }
}
```

和 @vue/cli-service 所使用的插件类似，@vue/cli 插件所提供的 generator 也是向外暴露一个函数，接收的第一个参数 api，然后通过该 api 提供的方法去完成应用的拓展工作。

开发者利用这个 api 实例去完成项目应用的拓展工作，这个 api 实例提供了：

* 拓展 package.json 配置方法(`api.extendPackage`)
* 利用 ejs 渲染模板文件的方法(`api.render`)
* 内存中保存的文件字符串全部被写入文件后的回调函数(`api.onCreateComplete`)
* 向文件当中注入`import`语法的方法(`api.injectImports`)
* ...


例如 @vue/cli-plugin-eslint 插件的 generator 方法主要是完成了：vue-cli-service cli lint 服务命令的添加、相关 lint 标准库的依赖添加等工作：

```javascript
module.exports = (api, { config, lintOn = [] }, _, invoking) => {
  if (typeof lintOn === 'string') {
    lintOn = lintOn.split(',')
  }

  const eslintConfig = require('./eslintOptions').config(api)

  const pkg = {
    scripts: {
      lint: 'vue-cli-service lint'
    },
    eslintConfig,
    devDependencies: {}
  }

  if (config === 'airbnb') {
    eslintConfig.extends.push('@vue/airbnb')
    Object.assign(pkg.devDependencies, {
      '@vue/eslint-config-airbnb': '^3.0.0-rc.10'
    })
  } else if (config === 'standard') {
    eslintConfig.extends.push('@vue/standard')
    Object.assign(pkg.devDependencies, {
      '@vue/eslint-config-standard': '^3.0.0-rc.10'
    })
  } else if (config === 'prettier') {
    eslintConfig.extends.push('@vue/prettier')
    Object.assign(pkg.devDependencies, {
      '@vue/eslint-config-prettier': '^3.0.0-rc.10'
    })
  } else {
    // default
    eslintConfig.extends.push('eslint:recommended')
  }

  ...

  api.extendPackage(pkg)

  ...

  // lint & fix after create to ensure files adhere to chosen config
  if (config && config !== 'base') {
    api.onCreateComplete(() => {
      require('./lint')({ silent: true }, api)
    })
  }
}
```

以上介绍了 @vue/cli 和插件系统相关的几个核心的模块，即：

add.js 提供了插件下载的 cli 命令服务和安装的功能；

invoke.js 完成插件所提供的 generator 方法的加载和执行，同时将项目当中的文件转化为字符串缓存到内存当中；

Generator.js 和插件进行桥接，@vue/cli 每次 add 一个插件时，都会实例化一个 Generator 实例与之对应；

GeneratorAPI.js 和插件一一对应，是 @vue/cli 暴露给插件的 api 对象，提供了很多项目应用的拓展工作。

---

## 总结

以上是对 Vue-cli@3.0 的插件系统当中两个主要部分：@vue/cli 和 @vue/cli-service 简析。前者主要完成了对于插件的依赖管理，项目模板的拓展等，后者主要是提供了在运行时本地开发构建的服务，同时后者也作为 @vue/cli 整个插件系统当中的内部核心插件而存在。在插件系统内部也对核心功能进行了插件化的拆解，例如 @vue/cli-service 内置的基础 webpack 配置，npm script 命令等。二者使用约定式的方式向开发者提供插件的拓展能力，具体到如何开发 @vue/cli 的插件[请戳我查阅相关文档](https://cli.vuejs.org/zh/dev-guide/plugin-dev.html)


