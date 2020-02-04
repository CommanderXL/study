## @vue/cli 项目编译重复命中缓存问题解析

### 背景

最近遇到一个更新了 package，但是编译打包没有更新代码的情况，先来复现下这个 case 的流程：

1. A 同学在 npm 上发布了`0.1.0`版本的 package；
2. B 同学开发了一个新的 feature，并发布`0.2.0`版本；
3. C 同学将本地的`0.1.0`版本升级到`0.2.0`版本，并执行`npm run deploy`，代码经过 webpack **本地编译**后发布到测试环境。但是测试环境的代码并不是最新的 package 的内容。但是在 node_modules 当中的 package 确实是最新的版本。

这个问题其实在社区里面有很多同学已经遇到了：

* [issue-4438](https://github.com/vuejs/vue-cli/issues/4438)
* [issue-3635](https://github.com/vuejs/vue-cli/issues/3635)
* [issue-2450](https://github.com/vuejs/vue-cli/issues/2450)

TL;DR(流程分析较复杂，可一拉到底)

### 发现 & 分析问题

翻了那些 issue 后，基本知道了是由于 webpack 在编译代码过程中走到 cache-loader 然后命中了缓存，这个缓存是之前编译的老代码，既然命中了缓存，那么就不会再去编译新的代码，于是最终编译出来的代码并不是我们所期望的。所以这个时候 `cd node_modules && rm -rf .cache && npm run deploy`，就是进入到 node_modules 目录，将 cache-loader 缓存的代码全部清除掉，并重新执行部署的命令，这些编译出来的代码肯定是最新的。

既然知道了问题的所在，那么就开始着手去分析这个问题的来龙去脉。这里我也简单的介绍下 cache-loader 的 workflow 是怎么进行的：

1. 在 cache-loader 上部署了 pitch 方法([有关 loader pitch function 的用法可戳我](https://webpack.docschina.org/api/loaders/#%E8%B6%8A%E8%BF%87-loader-pitching-loader-))，在 pitch 方法内部会根据生成的 cacheKey(例如abc) 去寻找 `node_modules/.cache` 文件夹下的缓存的 json 文件(abc.json)。其中 cacheKey 的生成支持外部传入 cacheIdentifier 和 cacheDirectory 具体参见[官方文档](https://github.com/webpack-contrib/cache-loader)。

```javascript
// cache-loader 内部定义的默认的 cacheIdentifier 及 cacheDirectory
const defaults = {
  cacheContext: '',
  cacheDirectory: findCacheDir({ name: 'cache-loader' }) || os.tmpdir(),
  cacheIdentifier: `cache-loader:${pkg.version} ${env}`,
  cacheKey,
  compare,
  precision: 0,
  read,
  readOnly: false,
  write
}

function cacheKey(options, request) {
  const { cacheIdentifier, cacheDirectory } = options;
  const hash = digest(`${cacheIdentifier}\n${request}`);

  return path.join(cacheDirectory, `${hash}.json`);
}
```

如果缓存文件(abc.json)当中记录的所有依赖以及这个文件都没发生变化，那么就会直接读取缓存当中的内容，并返回且跳过后面的 loader 的正常执行。一旦有依赖或者这个文件发生变化，那么就正常的走接下来的 loader 上部署的 pitch 方法，以及正常的 loader 处理文本文件的流程。

cache-loader 在决定是否使用缓存内容时是通过缓存内容当中记录的**所有的依赖文件的 mtime 与对应文件最新的 mtime 做对比**来看是否发生了变化，如果没有发生变化，即命中缓存，读取缓存内容并跳过后面的 loader 的处理，否则走正常的 loader 处理流程。

```javascript
function pitch(remainingRequest, prevRequest, dataInput) {
  ...
  // 根据 cacheKey 的标识获取对应的缓存文件内容
  readFn(data.cacheKey, (readErr, cacheData) => {
    async.each(
      cacheData.dependencies.concat(cacheData.contextDependencies), // 遍历所有依赖文件路径
      (dep, eachCallback) => {
        // Applying reverse path transformation, in case they are relatives, when
        // reading from cache
        const contextDep = {
          ...dep,
          path: pathWithCacheContext(options.cacheContext, dep.path),
        };

        // fs.stat 获取对应文件状态
        FS.stat(contextDep.path, (statErr, stats) => {
          if (statErr) {
            eachCallback(statErr);
            return;
          }

          // When we are under a readOnly config on cache-loader
          // we don't want to emit any other error than a
          // file stat error
          if (readOnly) {
            eachCallback();
            return;
          }

          const compStats = stats;
          const compDep = contextDep;
          if (precision > 1) {
            ['atime', 'mtime', 'ctime', 'birthtime'].forEach((key) => {
              const msKey = `${key}Ms`;
              const ms = roundMs(stats[msKey], precision);

              compStats[msKey] = ms;
              compStats[key] = new Date(ms);
            });

            compDep.mtime = roundMs(dep.mtime, precision);
          }
          
          // 对比当前文件最新的 mtime 和缓存当中记录的 mtime 是否一致
          // If the compare function returns false
          // we not read from cache
          if (compareFn(compStats, compDep) !== true) {
            eachCallback(true);
            return;
          }
          eachCallback();
        });
      },
      (err) => {
        if (err) {
          data.startTime = Date.now();
          callback();
          return;
        }
        ...
        callback(null, ...cacheData.result);
      }
    );
  })
}
```

2. 通过 @vue/cli 初始化的项目内部会通过脚手架去完成 webpack 相关的配置，其中针对 vue SFC 文件当中的`script block`及`template block`在代码编译构建的流程当中都利用了 cache-loader 进行了缓存相关的配置工作。

```javascript
// @vue/cli-plugin-babel
module.export = (api, options) => {
  ...
  api.chainWebpack(webpackConfig => {
    const jsRule = webpackConfig.module
      .rule('js')
        .test(/\.m?jsx?$/)
        .use('cache-loader')
          .loader(require.resolve('cache-loader'))
          .options(api.genCacheConfig('babel-loader', {
            '@babel/core': require('@babel/core/package.json').version,
            '@vue/babel-preset-app': require('@vue/babel-preset-app/package.json').version,
            'babel-loader': require('babel-loader/package.json').version,
            modern: !!process.env.VUE_CLI_MODERN_BUILD,
            browserslist: api.service.pkg.browserslist
          }, [
            'babel.config.js',
            '.browserslistrc'
          ]))
          .end()
    jsRule
      .use('babel-loader')
        .loader(require.resolve('babel-loader'))
  })
  ...
}

// @vue/cli-serive/lib/config
module.exports = (api, options) => {
  ...
  api.chainWebpack(webpackConfig => {
    const vueLoaderCacheConfig = api.genCacheConfig('vue-loader', {
      'vue-loader': require('vue-loader/package.json').version,
      /* eslint-disable-next-line node/no-extraneous-require */
      '@vue/component-compiler-utils': require('@vue/component-compiler-utils/package.json').version,
      'vue-template-compiler': require('vue-template-compiler/package.json').version
    })

    webpackConfig.module
      .rule('vue')
        .test(/\.vue$/)
        .use('cache-loader')
          .loader(require.resolve('cache-loader'))
          .options(vueLoaderCacheConfig)
          .end()
        .use('vue-loader')
          .loader(require.resolve('vue-loader'))
          .options(Object.assign({
            compilerOptions: {
              whitespace: 'condense'
            }
          }, vueLoaderCacheConfig))
    ...
  })
}
```

即：

* 对于`script block`来说经过`babel-loader`的处理后经由`cache-loader`，若之前没有进行缓存过，那么新建本地的缓存 json 文件，若命中了缓存，那么直接读取经过`babel-loader`处理后的 js 代码；
* 对于`template block`来说经过`vue-loader`转化成 renderFunction 后经由`cache-loader`，若之前没有进行缓存过，那么新建本地的缓存 json 文件，若命中了缓存，那么直接读取 json 文件当中缓存的 renderFunction。

上面对于 cache-loader 和 @vue/cli 内部工作原理的简单介绍。那么在文章一开始的时候提到的那个 case 具体是因为什么原因导致的呢？

**事实上在`npm 5.8+`版本，npm 将发布的 package 当中包含的文件的 mtime 都统一置为了`1985-10-26T08:15:00.000Z`**。

A 同学（npm版本为6.4.1）发布了`0.1.0`的版本后，C 同学安装了`0.1.0`版本，本地构建后生成缓存文件记录的文件 mtime 为`1985-10-26T08:15:00.000Z`。B 同学（npm版本为6.2.1）发布了`0.2.0`，C 同学安装`0.2.0`版本，本地开始构建，但是经由 cache-loader 的过程当中，cache-loader 通过对比缓存文件记录的依赖的 mtime 和新安装的 package 的文件的 mtime，但是发现都是`1985-10-26T08:15:00.000Z`，这样也就命中了缓存，即直接获取上一次缓存文件当中所包含的内容，而不会对新安装的 package 的文件进行编译。

针对这个问题，@vue/cli 在19年4月的`3.7.0`版本([具体代码变更的内容请戳我](https://github.com/sodatea/vue-cli/commit/1fd729c87a873b779331335983e7c93223488c0f))当中也做了相关的修复性的工作，主要是将：`package-lock.json`、`yarn.lock`、`pnpm-lock.yaml`，这些做版本控制文件也加入到了 hash 生成的策略当中：

```javascript
// @vue/cli-service/lib/PluginAPI.js

class PluginAPI {
  ...
  genCacheConfig(id, partialIdentifier, configFiles = []) {
    ...
    if (!Array.isArray(configFiles)) {
      configFiles = [configFiles]
    }
    configFiles = configFiles.concat([
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ])

    const readConfig = file => {
      const absolutePath = this.resolve(file)
      if (!fs.existsSync(absolutePath)) {
        return
      }

      if (absolutePath.endsWith('.js')) {
        // should evaluate config scripts to reflect environment variable changes
        try {
          return JSON.stringify(require(absolutePath))
        } catch (e) {
          return fs.readFileSync(absolutePath, 'utf-8')
        }
      } else {
        // console.log('the absolute path is:', fs.readFileSync(absolutePath, 'utf-8'))
        return fs.readFileSync(absolutePath, 'utf-8')
      }
    }

    // 获取版本控制文件的文本内容
    for (const file of configFiles) {
      const content = readConfig(file)
      if (content) {
        variables.configFiles = content.replace(/\r\n?/g, '\n')
        break
      }
    }

    // 将带有版本控制文件的内容加入到 hash 算法当中，生成新的 cacheIdentifier
    // 并传入 cache-loader(缓存文件的 cacheKey 依据这个 cacheIdentifier 来生成，👆上文有说明)
    const cacheIdentifier = hash(variables)
    return { cacheDirectory, cacheIdentifier }
  }
}
```

这样来做的核心思想就是：**当你升级了某个 package 后，相应的版本控制文件也会对应的更新(例如 package-lock.json)，那么再一次进行编译流程时，所生成的缓存文件的 cacheKey 就会是最新的，因为也就不会命中缓存，还是走正常的全流程的编译，最终打包出来的代码也就是最新的。**

不过这次升级后，还是有同学在社区反馈命中缓存，代码没有更新的问题，而且出现的 case 是 package 当中需要走 babel-loader 的 js 会遇到命中缓存不更新的情况，但是 package 当中被项目代码引用的 vue 的 template 文件不会出现这种情况。后来我调试了下`@vue/cli-service/lib/PluginAPI.js`的代码，发现代码在读取多个配置文件的过程中，一旦获取到某个配置文件的内容后就不再读取后面的配置文件的内容了，这样也就导致就算`package-lock.json`发生了更新，但是因为在编译流程当中并未读取`package-lock.json`这个文件的最新的内容话，那么也就不会生成新的 cacheKey，仍然会出现命中缓存的问题：

```javascript
// 针对需要走 babel-loader 流程的配置文件为：
['babel.config.js', '.browserslistrc', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
// 针对需要缓存的 vue template 的配置文件为：
['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']

// @vue/cli-service/lib/PluginAPI.js
class PluginAPI {
  ...
  genCacheConfig(id, partialIdentifier, configFiles = []) {
    ...
    if (!Array.isArray(configFiles)) {
      configFiles = [configFiles]
    }
    configFiles = configFiles.concat([
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ])

    const readConfig = file => {
      ...
    }

    // 一旦获取到某个配置文件的内容后，就直接跳出了 for ... of 的循环
    // 那么也就不会继续获取其他配置文件的内容，
    // 所以对于处理 js 文件的流程来说，因为读取了 babel.config.js 的内容，那么也就不会再去获取更新后的 packge-lock.json 文件内容
    // 但是对于处理 vue template 的流程来说，配置文件当中第一项就位 package-lock.json，这种情况下会获取最新的 package-lock.json 文件，所以对于 vue template 的不会出现升级了 package 内容，但是会因为命中缓存，导致编译代码不更新的情况。
    for (const file of configFiles) {
      const content = readConfig(file)
      if (content) {
        variables.configFiles = content.replace(/\r\n?/g, '\n')
        break
      }
    }

    const cacheIdentifier = hash(variables)
    return { cacheDirectory, cacheIdentifier }
  }
}
```

不过就在前几天，@vue/cli 的作者也重新看了下这个有关 vue template 正常，但是对于 js 命中缓存的原因，并针对这个问题进行了修复([具体代码内容变更请戳我](https://github.com/vuejs/vue-cli/pull/5113/files))，这次的代码变更就是通过 map 循环(而非 for ... of 循环读取到内容后直接 break)，这样去确保所有的配置文件都被获取得到：

```javascript
variables.configFiles = configFiles.map(file => {
  const content = readConfig(file)
  return content && content.replace(/\r\n?/g, '\n')
}
```

目前在`@vue/cli-service@4.1.2`版本中已经进行了修复。

以上就是通过 @vue/cli 初始化的项目，在升级 package 的过程中，cache-loader 命中缓存，新一轮代码编译生成非最新代码问题的分析。

## 总结 & 解决方案

cache-loader 使用缓存文件(`node_modules/.cache`)记录了不同依赖文件的 mtime，并通过对比缓存记录的 mtime 和最新文件的 mtime 是否发生了变化来觉得是否使用缓存。由于`npm@5.8.0`之后，每次新发布的 package 内部所包含的文件的 mtime 都被重置为`1985-10-26T08:15:00.000Z`，导致 cache-loader 这个对比 mtime 的策略失效。因为 @vue/cli-service 从`3.7.0`(19年4月)版本针对这个问题进行了第一次的修复，核心思想就是将`package-lock.json`这样的版本控制文件的内容纳入到了生成缓存文件的 cacheKey 的 hash 算法当中，每次升级 package 后，`package-lock.json`也会随之变化，这样会生成新的 cacheKey，进而不会命中缓存策略，这样也就解开了由于 npm 重置 mtime 而带来的重复命中缓存的问题，但是`3.7.0`版本的修复是有bug的，主要就是有些项目当中`package-lock.json`(由项目结构决定)这样的版本控制文件根本就没有被读取，导致 cache-loader 生成的 cacheKey 依然没有变化。然后在前几天(2020年1月28日)，@vue/cli 的作者重新针对这个问题进行优化，确保`package-lock.json`版本控制文件能被读取到，从而避免 cacheKey 不变的问题，于`@vue/cli-service@4.1.2`版本中完全修复了重复命中缓存的问题。

这里比较有意思的一点就是这个问题的出现需要满足2个条件：

1. 发布 package 的同学使用的 npm 的版本需要高于 5.8.0；
2. 使用 package 的同学使用的 @vue/cli-service 的版本要低于 4.1.2 版本

比如我一直使用的 node 版本为 8.11.0，对应的 npm 版本为 5.6.0，那么经由我去修改发布的所有 package 所包含的文件的 mtime 都是被修改的那一刻，其他人升级到我发布的版本后，是不会出现重复命中缓存的问题。

不过既然问题被梳理清楚后，那么本地编译的过程避免出现这个问题的解决方式：

1. 如果你的项目使用 @vue/cli@4.x 初始化的，那么直接升级 @vue/cli-service 到 4.1.2 版本即可；
2. 如果你不想升级 @vue/cli-service 的版本(特别是你是使用 @vue/cli@3.x 版本初始化项目的同学，可能会出现兼容性问题，具体可自行测试)，那么可以在每次本地编译开始前，删除掉`node_module/.cache`文件夹，例如将本地编译构建的`npm script`修改为`rm -rf node_module/.cache && vue-cli-service build`。(不过对于大型的项目来说，少了这部分的缓存内容的话，编译速度还是会受到一定的影响的。)