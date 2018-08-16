# Vue-cli@3.0 插件系统简析

Vue cli@3.0 是一个全新的 Vue 项目脚手架。不同于 1.x/2.x 基于模板的脚手架，Vue cli@3.0 采用了一套基于插件的架构，它将部分核心功能收敛至 cli 内部，同时对开发者暴露可拓展的 API 已供开发者对 cli 的功能进行灵活的拓展和配置。接下来我们就通过 Vue cli@3.0 的源码来看下这套插件架构是如何设计的。

当你使用 `vue create <project-name>`创建一个新的 Vue 项目后，你会发现项目相较于之前的模板发生了很大的变化，

TODO：补一个项目的结构图

关于 webpack 相关的配置以及 npm script 都没有在模板里面直接暴露出来，而是提供了新的 npm script:

```javascript
// package.json

"scripts": {
  "serve": "vue-cli-service serve",
  "build": "vue-cli-service build",
  "lint": "vue-cli-service lint"
}
```

前 2 个脚本命令是项目本地安装的 @vue/cli-serve 所提供的基于 webpack 及相关的插件进行封装的本地开发/构建的服务。@vue/cli-serve 将 webpack 及相关插件提供的功能都收敛到 @vue/cli-serve 内部来实现。这 2 个命令对应于 node_modules/@vue/cli-service/lib/commands 下的 serve.js 和 build/index.js 。

在 serve.js 和 build/index.js 的内部分别暴露了一个函数及一个 defaultModes 属性供外部来使用。**事实上这两者都是作为 built-in（内置）插件来供 vue-cli-service 来使用的**。

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
    this.plugins = this.resolvePlugins(plugins, useBuiltIn)   // 完成插件的初始化
    ...
  }
}
```

在实例化 Service 的过程当中首先会完成插件的加载工作：

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

在这个 resolvePlugins 方法当中，主要完成了对于 @vue/cli-service 内部提供的插件以及项目应用(package.json)当中需要使用的插件的加载，并将对应的插件进行缓存。我们注意到 builtInPlugins 主要分为了 2 类，一类为：

```javascript
'./commands/serve'
'./commands/build'
'./commands/inspect'
'./commands/help'
```

这一类插件在内部通过注册的方式去初始化一个新的 cli 命令，并对外暴露提供给开发者进行使用。例如在 ./commands/serve 内部，首先通过 API 的形式去注册 `vue-cli-service serve`本地开发服务：

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

插件对外暴露一个函数，接收到的第一个参数 api 提供了 cli 命令的注册功能。

除了上述提到的几种完成 cli 命令注册的插件外，还有一类插件为：

```javascript
'./config/base'
'./config/css'
'./config/dev'
'./config/prod'
'./config/app'
```

这一类插件主要是完成 webpack 本地编译构建时的各种相关的配置，和提供 cli 命令注册的插件一样，webpack 配置插件同样向外暴露一个函数，接收到的第一个参数 api 提供了 chainWebpack 方法来完成 webpack 的相关配置。例如在`./config/base`内部，完成了 webpack 的基本配置内容，例如 entry、output、加载不同文件类型的 loader 的配置：

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

// 有关 webpack 其他相关的配置请参照对应的源码
```

**不同于之前使用的配置式的 webpack 使用方式，@vue/cli-service 使用 [webpack-chain](https://github.com/mozilla-neutrino/webpack-chain) 来完成 webpack 配置的更新和修改**。这种方式也使得 webpack 的配置更加灵活，当你的项目迁移至 @vue/cli@3.0 ，使用的 webpack 插件也必须要使用 API 式的配置，同时插件不仅仅要提供插件自身的功能，同时也需要帮助调用方完成插件的注册等工作。

在上面提到的关于插件统一的格式都是向外暴露一个函数，接收的第一个参数为`api`，它是由 PluginAPI.js 实例化产生的：

```javascript
class PluginAPI {
  constructor (id, service) {
    this.id = id            // 对应这个插件名
    this.service = service  // 对应 Service 类的实例(单例)
  }
  ...
  registerCommand (name, opts, fn) {  // 注册 cli 命令
    if (typeof opts === 'function') {
      fn = opts
      opts = null
    }
    this.service.commands[name] = { fn, opts: opts || {}}
  }
  chainWebpack (fn) {   // 变更 webpack 配置
    this.service.webpackChainFns.push(fn)
  }
  ...
}
```

每一个插件在被调用的过程中，都会接收一个新的 PluginAPI 实例，这个 api 实例提供了：

- 注册 cli 命令服务(`api.registerCommand`)
- 变更 webpack 配置(`api.chainWebpack`)
- resolve wepack 配置(`api.resolveWebpackConfig`)
- ...

当 Service 实例化完成后，调用实例上的`run`方法来启动对应的 cli 命令所提供的服务。

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
  // 注册plugins
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

以上介绍了 @vue/cli-service 插件系统当中几个核心的模块，即：

Service.js 提供服务的基类，它提供了 @vue/cli 生态当中本地开发构建时：插件加载(包括内部插件和项目应用插件)、插件的初始化，它的单例被所有的插件所共享，插件使用它的单例去完成 webpack 的更新。

PluginAPI.js 提供供插件使用的对象接口，它和插件是一一对应的关系。所有供 @vue/cli-service 使用的本地开发构建的插件接收的第一个参数都是 PluginAPI 的实例（api），插件使用这个实例（api）去完成 cli 命令的注册及对应服务的执行，webpack 配置的更新等。

以上就是 @vue/cli-service 插件系统简单的分析，感兴趣的同学可以深入阅读相关源码进行学习。


@vue/cli 提供了终端里面的 vue 命令，这里我们主要来看下和插件相关的命令服务。@vue/cli@3.0 提供的插件安装方式为一个 cli 服务：`vue add <plugin>`：

> install a plugin and invoke its generator in an already created project

执行这条命令后，@vue/cli 会帮你完成插件的下载，安装以及执行插件所提供的 generator 方法。整个流程的执行顺序大家可以通过阅读源码去深入了解。这里主要简单聊聊插件作为 @vue/cli 生态中重要的一部分它所完成的工作及提供的相关的功能。之前 1.x/2.x 的 vue-cli 工具都是基于远程模板去完成项目的初始化的工作，它属于那种大而全的方式，在远程模板里面帮开发者将所有的配置文件初始化完成好。而 @vue/cli@3.0 主要是基于插件的 generator 方法去完成项目的初始化的工作，它将原来的大而全的模板拆解为现在基于插件系统的工作方式，每个插件完成自己所要对于项目应用的模板拓展工作。例如：@vue/cli-plugin-eslint 插件的 generator 方法内部：

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

和 @vue/cli-service 所使用的插件类似，@vue/cli 的插件 generator 方法也是向外暴露一个函数，接收的第一个参数 api，然后通过 api 提供的方法去完成项目应用的拓展工作(下文会具体解释这个 api 对象)。@vue/cli-plugin-eslint 插件的 generator 方法主要是完成了：vue-cli-service cli lint 服务命令的添加、相关 lint 标准库的依赖添加等工作。


接下来就简单的梳理下 @vue/cli 安装插件以及插件是如何完成相关的功能的。

例如执行`vue add vue-plugin-cube-ui`安装 cube-ui 的插件，首先：

```javascript
// @vue/cli/lib/add.js

async function add (pluginName, options = {}, context = process.cwd()) {

  ...

  const packageManager = loadOptions().packageManager || (hasProjectYarn(context) ? 'yarn' : 'npm')
  // 开始安装这个插件
  await installPackage(context, packageManager, null, packageName)

  log(`${chalk.green('✔')}  Successfully installed plugin: ${chalk.cyan(packageName)}`)
  log()

  // 判断插件是否提供了generator方法
  const generatorPath = resolveModule(`${packageName}/generator`, context)
  if (generatorPath) {
    invoke(pluginName, options, context)
  } else {
    log(`Plugin ${packageName} does not have a generator to invoke`)
  }
}
```

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

和 @vue/cli-service 一样，在 @vue/cli 内部也有一个核心的类`Generator`，每个`@vue/cli`的插件对应一个`Generator`的实例。在实例化`Generator`方法的过程当中，完成插件提供的 generator 方法的执行。

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

再回到一开始提到 @vue/cli 会给插件提供的 generator 方法传入一个 GeneratorAPI 实例。开发者利用这个 api 实例去完成项目应用的拓展工作，这个 api 实例提供了：

* 拓展 package.json 配置方法(`api.extendPackage`)
* 利用 ejs 渲染模板文件的方法(`api.render`)
* 内存中保存的文件字符串全部被写入文件后的回调函数(`api.onCreateComplete`)
* 向文件当中注入`import`语法的方法(`api.injectImports`)
* ...


以上介绍了 @vue/cli 和插件系统相关的几个核心的模块，即：

add.js 提供了插件下载的 cli 命令服务和安装的功能；

invoke.js 完成插件所提供的 generator 方法的加载和执行，同时将项目当中的文件转化为字符串缓存到内存当中；

Generator.js 和插件进行桥接，@vue/cli 每次 add 一个插件时，都会实例化一个 Generator 实例与之对应；

GeneratorAPI.js 和插件一一对应，是 @vue/cli 暴露给插件的 api 对象，提供了很多项目应用的拓展工作。