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