## Cache-loader

### 背景

首先来复现下整个case的流程：

1. A同学在 npm 上发布了 0.1.0 版本的 package；
2. B同学开发了一个新的 feature，并发布 0.2.0 版本；
3. C同学将本地的 0.1.0 版本升级到 0.2.0 版本，并执行`npm run deploy`，代码经过 webpack **本地编译**后发布到测试环境。但是测试环境的代码并不是最新的 package 的内容。但是在 node_modules 当中的 package 确实是最新的版本。

这个问题其实在社区里面有很多同学已经遇到了：

* [issue-4438](https://github.com/vuejs/vue-cli/issues/4438)
* [issue-3635](https://github.com/vuejs/vue-cli/issues/3635)
* [issue-2450](https://github.com/vuejs/vue-cli/issues/2450)

### 发现问题

看了那个 issue 后，基本知道了是由于 webpack 在编译代码过程中走到 cache-loader 然后命中了缓存，这个缓存是之前编译的老代码，既然命中了缓存，那么就不会再去编译新的代码，于是最终编译出来的代码并不是我们所期望的。所以这个时候 `cd node_modules && rm -rf .cache && npm run deploy`，就是进入到 node_modules 目录，将 cache-loader 缓存的代码全部清除掉，并重新执行部署的命令，这些编译出来的代码肯定是最新的。

既然知道了问题的所在，那么就开始着手去分析这个问题的来龙去脉。这里我也简单的介绍下 cache-loader 的 workflow 是怎么进行的：

// 1. transpileDep 配置
// 2. js -> babel-loader -> cache-loader  

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

* 对于`script block`来经过`babel-loader`的处理后经由`cache-loader`，若之前没有进行缓存过，那么新建本地的缓存 json 文件，若命中了缓存，那么直接读取经过`babel-loader`处理后的 js 代码；
* 对于`template block`来说经过`vue-loader`转化成 renderFunction 后经由`cache-loader`，若之前没有进行缓存过，那么新建本地的缓存 json 文件，若命中了缓存，那么直接读取 json 文件当中缓存的 renderFunction。

上面对于 cache-loader 和 @vue/cli 内部工作原理的简单介绍。那么在文章一开始的时候提到的那个 case 具体是因为什么原因导致的呢？