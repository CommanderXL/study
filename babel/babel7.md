# Babel7 相关

## @babel/preset-env

`@babel/preset-env` 主要的功能是依据项目经过 `babel` 编译构建后产生的代码所对应运行的目标平台。`@babel/preset-env` 内部依赖了很多插件： `@babel/plugin-transform-*`。这些插件的工作主要就是 `babel` 在处理代码的过程当中对于新的 ES 语法的转换，将高版本的语法转化为低版本的写法。例如 `@babel/plugin-transform-arrow-function` 是用来转化箭头函数语法的。

基本的配置方法：

```javascript
// babel.config.json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        // 相关 preset 的配置
      }
    ]
  ]
}
```

对于 `web` 侧的项目或者 基于 `Electron` 的项目，一般会搭配着 `.browserlistrc` (或 `package.json` 里的 `browserslist` 字段) 来使用（确定最终构建平台）。

### 相关 options 配置

#### useBuiltIns

> "usage" | "entry" | false, defaults to false.

这个配置选项也决定了 `@babel/preset-env` 如何去引用 polyfills。当这个配置选项为：`usage` 或 `entry`，`@babel/preset-env` 会直接建立起对于 `core-js` 相关 module 的引用。因此这也意味着 `core-js` 会被解析为对应的相对路径同时需要确保 `core-js` 在你的项目当中已经被安装了。

因为从 `@babel/polyfill` 从 7.4.0 版本开始就被弃用了，**因此推荐直接配置 `corejs` 选项，并在项目当中直接安装 `core-js`**。

##### useBuiltIns: 'entry'

使用这种方式的配置需要在你的业务代码当中注入：

```javascript
import 'core-js/stable'
import 'regenerator-runtime/runtime'
```

在 `babel` 处理代码的过程当中，会引入一个新的插件，同时 `@babel/preset-env` 会根据目标平台，例如 `target` 当中的配置，或者是 `.browserlistrc` 等来引入对应平台所需要的 `polyfill` ：

In:

```javascript
import 'core-js'
```

Out(different based on environment):

```javascript
import "core-js/modules/es.string.pad-start"
import "core-js/modules/es.string.pad-end"
```

**注：其实这里的 useBuiltIns: `entry` 的配置以及需要在业务代码当中需要注入 `core-js`和 `regenerator-runtime/runtime`，在业务代码当中注入对应的 package 从使用上来讲更多的是起到了占位的作用，由 `@babel/preset-env` 再去根据不同的目标平台去引入对应所需要的 `polyfill` 文件**

同时在使用的过程中，如果是 `import 'core-js'` 那么在处理的过程当中会引入所有的 `ECMAScript` 特性的 polyfill，如果你只希望引入部分的特性，那么可以：

In:

```javascript
import 'core-js/es/array'
import 'core-js/proposals/math-extensions'
```

Out:

```javascript
import "core-js/modules/es.array.unscopables.flat";
import "core-js/modules/es.array.unscopables.flat-map";
import "core-js/modules/esnext.math.clamp";
import "core-js/modules/esnext.math.deg-per-rad";
import "core-js/modules/esnext.math.degrees";
import "core-js/modules/esnext.math.fscale";
import "core-js/modules/esnext.math.rad-per-deg";
import "core-js/modules/esnext.math.radians";
import "core-js/modules/esnext.math.scale";
```

##### useBuiltIns: 'usage'

自动探测代码当中使用的新的特性，并结合目标平台来决定引入对应新特性的 `polyfill`，因此这个配置是会最大限度的去减少引入的 `polyfill` 的数量来保证最终生成的 `bundler` 体积大小。

**不过需要注意的是：由于 `babel` 处理代码本来就是一个非常耗时的过程，因此在我们实际的项目当中一般是对于 `node_modules` 当中的 `package` 进行 `exclude` 配置给忽略掉的，除非是一些明确需要走项目当中的 `babel` 编译的 `package` 会单独的去 `include`，所以 `useBuiltIns: 'usage'` 这种用法的话有个风险点就是 `node_modules` 当中的第三方包在实际的编译打包处理流程当中没有被处理（例如有些 `package` 提供了 esm 规范的源码，同时 `package.json` 当中也配置了 `module` 字段，那么例如使用 `webpack` 这样的打包工具的话会引入 `module` 字段对应的入口文件）**

同时，如果使用 `useBuiltIns: 'usage'` 配置的话。是会在每个文件当中去引入相关的 `polyfill` 的，所以这里如果不借助 `webpack` 这种打包工具的话，是会造成代码冗余的。

##### useBuiltIns: false

Don't add polyfills automatically per file, and don't transform import "core-js" or import "@babel/polyfill" to individual polyfills.

#### corejs

`corejs` 的配置选项需要搭配着 `useBuiltIns: usage` 或 `useBuiltIns: entry` 来使用。默认情况下，被注入的 polyfill 都是稳定的已经被纳入 `ECMAScript` 规范当中的特性。如果你需要使用一些 proposals 当中的 feature 的话，那么需要配置：

```javascript
{
  "presets": [
    [
      "@babel/preset-env",
      {
        // 相关 preset 的配置
        corejs: {
          version: 3,
          proposals: true
        }
      }
    ]
  ]
}
```


## @babel/plugin-transform-runtime

出现的背景：

`Babel` 在编译处理代码的过程当中会使用一些 helper 辅助函数，例如 `_extend`。这些辅助函数一般都会被添加到每个需要的被处理的文件当中。

因此 `@babel/plugin-transform-runtime` 所要解决的问题就是将所有对于需要这些 helper 辅助函数的引入全部指向 `@babel/runtime/helpers` 这个 module 当中的辅助函数，而不是给每个文件都添加对应 helper 辅助函数的内容。

另外一个目的就是去创建一个沙盒环境。因为如果你直接引入 `core-js`，或者 `@babel/polyfill` 的话，它所提供的 polyfill，例如 `Promise`，`Set`，`Map` 等，是直接在全局环境下所定义的。因此会影响到所有使用到这些 API 的文件内容。所以如果你是写一个 library 的话，最好使用 @babel/plugin-transform-runtime 来完成相关 polyfill 的引入，这样能避免污染全局环境。

**这个插件所做的工作其实也是引用 `core-js` 相关的模块来完成 `polyfill` 的功能。最终所达到的效果和使用 `@babel/polyfill` 是一样的。**

### 技术实现细节

The transform-runtime transformer plugin does three things:

1. Automatically requires @babel/runtime/regenerator when you use generators/async functions (toggleable with the regenerator option).

2. Can use core-js for helpers if necessary instead of assuming it will be polyfilled by the user (toggleable with the corejs option)

3. Automatically removes the inline Babel helpers and uses the module @babel/runtime/helpers instead (toggleable with the helpers option).


What does this actually mean though? Basically, you can use built-ins such as Promise, Set, Symbol, etc., as well use all the Babel features that require a polyfill seamlessly, without global pollution, making it extremely suitable for libraries.

## 相关文档

1. [@babel/plugin-transform-runtime](https://babel.docschina.org/docs/en/babel-plugin-transform-runtime)