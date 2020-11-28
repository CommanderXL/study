# Babel7 相关

## @babel/preset-env

`@babel/preset-env` 主要的功能是依据项目经过 `babel` 编译构建后产生的代码所对应运行的平台。

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

不过需要注意的是：由于 `babel` 处理代码本来就是一个非常耗时的过程，因此在我们实际的项目当中一般是对于 `node_modules` 当中的 `package` 进行 `exclude` 配置给忽略掉的，除非是一些明确需要走项目当中的 `babel` 编译的 `package` 会单独的去 `include`，所以 `useBuiltIns: 'usage'` 这种用法的话有个风险点就是 `node_modules` 当中的第三方包在实际的编译打包处理流程当中没有被处理（例如有些 `package` 提供了 esm 规范的源码，同时 `package.json` 当中也配置了 `module` 字段，那么例如使用 `webpack` 这样的打包工具的话会引入 `module` 字段对应的入口文件）

##### useBuiltIns: false

Don't add polyfills automatically per file, and don't transform import "core-js" or import "@babel/polyfill" to individual polyfills.

#### corejs

`corejs` 的配置选项需要搭配着 `useBuiltIns: usage` 或 `useBuiltIns: entry` 来使用。默认情况下，被注入的 polyfill 都是稳定的已经被纳入 `ECMAScript` 规范当中的特性。