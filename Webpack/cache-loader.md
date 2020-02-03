## Cache-loader

### 背景

首先来复现下整个case的流程：

A同学在内网当中私有 npm 上发布了一个 0.1.0 版本的 package，后来B同学更新了这个 package 的内容，并发布了 0.2.0 版本，并通知其他同学去更新最新的 package 版本。当我更新了版本后，我需要将最新的代码部署到测试环境，然后我顺手执行了`npm run deploy`，执行了这个 npm script 后，正常情况下 webpack 会将最新的代码在**本地进行编译**并发布到测试环境当中。但是我却发现不管我执行了几遍这个命令后，测试环境的代码都不是最新的。

这个时候我问了下旁边的同学是有也遇到了更新了 package，但是代码重新编译后却不是最新的这种情况。有好几位同学都反馈遇到了这个问题，其中有位同学发给了我一个 [issue 的链接](https://github.com/vuejs/vue-cli/issues/3635)。issue 当中反馈的问题基本和我们遇到的 case 是一样的。


### 发现问题

看了那个 issue 后，基本知道了是由于 webpack 在编译代码过程中走到 cache-loader 然后命中了缓存，这个缓存是之前编译的老代码，既然命中了缓存，那么就不会再去编译新的代码，于是最终编译出来的代码并不是我们所期望的。所以这个时候 `cd node_modules && rm -rf .cache && npm run deploy`，就是进入到 node_modules 目录，将 cache-loader 缓存的代码全部清除掉，并重新执行部署的命令，这些编译出来的代码肯定是最新的。

既然知道了问题的所在，那么就开始着手去分析这个问题的来龙去脉。这里我也简单的介绍下 cache-loader 的 workflow 是怎么进行的：

// 1. transpileDep 配置
// 2. js -> babel-loader -> cache-loader  

1. 在 cache-loader 上部署了 pitch 方法([有关 loader pitch function 的用法可戳我](https://webpack.docschina.org/api/loaders/#%E8%B6%8A%E8%BF%87-loader-pitching-loader-))，在 pitch 方法内部会根据生成的 cacheKey(例如xxx) 去寻找 `node_modules/.cache` 文件夹下的缓存的 json 文件(xxx.json)。如果这个文件的所有依赖以及这个文件都没发生变化(cache-loader 是如何判断文件是否发生变化了后文会讲)，那么就会直接读取缓存当中的内容，并返回且跳过后面的 loader 的正常执行。一旦有依赖或者这个文件发生变化，那么就正常的走接下来的 loader 上部署的 pitch 方法，以及正常的 loader 处理文本文件的流程。

其中 cacheKey 的生成支持外部传入 cacheIdentifier 和 cacheDirectory 具体参见[官方文档](https://github.com/webpack-contrib/cache-loader)。

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
  write,
}

function cacheKey(options, request) {
  const { cacheIdentifier, cacheDirectory } = options;
  const hash = digest(`${cacheIdentifier}\n${request}`);

  return path.join(cacheDirectory, `${hash}.json`);
}
```

2. 通过 @vue/cli 初始化的项目内部会通过脚手架去完成 webpack 相关的配置，其中针对 vue SFC 文件当中的`script block`及`template block`在代码编译构建的流程当中都进行了缓存相关的配置工作，即：

* 对于`script block`来经过`babel-loader`的处理后经由`cache-loader`，若之前没有进行缓存过，那么新建本地的缓存 json 文件，若命中了缓存，那么直接读取经过`babel-loader`处理后的 js 代码；
* 对于`template block`来说经过`vue-loader`转化成 renderFunction 后经由`cache-loader`，若之前没有进行缓存过，那么新建本地的缓存 json 文件，若命中了缓存，那么直接读取 json 文件当中缓存的 renderFunction。

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
