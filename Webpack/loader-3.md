## Webpack Loader 详解

前2篇文章主要通过源码分析了 loader 的配置，匹配和加载，执行等内容，这篇文章会通过具体的实例来学习下如何去实现一个 loader。

这里我们来看下 [vue-loader(v15)](https://vue-loader.vuejs.org/zh/#vue-loader-%E6%98%AF%E4%BB%80%E4%B9%88%EF%BC%9F) 内部的相关内容，这里会讲解下有关 vue-loader 的大致处理流程，不会深入特别细节的地方。

```shell
git clone git@github.com:vuejs/vue-loader.git
```


首先我们都知道 vue-loader 配合 webpack 给我们开发 vue 应用提供了非常大的便利性，允许我们在 SFC(single file component) 中去写我们的 template/script/style，同时 v15 版本的 vue-loader 还允许开发在 sfc 当中写 custom block。最终一个 vue sfc 通过 vue-loader 的处理，会将 template/script/style/custom style 拆解为独立的 block，每个 block 还可以再交给对应的 loader 去做进一步的处理，例如你的 template 是使用 pug 来书写的，那么首先使用 vue-loader 获取一个 sfc 内部 pug 相关的内容，然后再交给 pug 相关的 loader 去做处理，因此可以说 vue-loader 对于 sfc 来说是一个入口。

在实际运用过程中，我们先来看下有关 vue 的 webpack 配置：

```javascript
const VueloaderPlugin = require('vue-loader/lib/plugin')

module.exports = {
  ...
  module: {
    rules: [
      ...
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      }
    ]
  }

  plugins: [
    new VueloaderPlugin()
  ]
  ...
}
```

一个就是 module.rules 有关的配置，如果处理的 module 路径是以`.vue`形式结尾的，那么会交给 vue-loader 来处理，同时在 v15 版本会需要你使用 vue-loader 内部提供的一个 plugin，具体内容后文会说明。

接下来我们就来看下 vue-loader 的内部实现。首先来看下入口文件的相关内容：

```javascript
// vue-loader/lib/index.js
const { parse } = require('@vue/component-compiler-utils')

function loadTemplateCompiler () {
  try {
    return require('vue-template-compiler')
  } catch (e) {
    throw new Error(
      `[vue-loader] vue-template-compiler must be installed as a peer dependency, ` +
      `or a compatible compiler implementation must be passed via options.`
    )
  }
}

module.exports = function(source) {
  const loaderContext = this // 获取 loaderContext 对象

  // 从 loaderContext 获取相关参数
  const {
    target, // webpack 构建目标，默认为 web
    request, // module request 路径(由 path 和 query 组成)
    minimize, // 构建模式
    sourceMap, // 是否开启 sourceMap
    rootContext, // 项目的根路径
    resourcePath, // module 的 path 路径
    resourceQuery // module 的 query 参数
  } = loaderContext

  // 接下来就是一系列对于参数和路径的处理
  const rawQuery = resourceQuery.slice(1)
  const inheritQuery = `&${rawQuery}`
  const incomingQuery = qs.parse(rawQuery)
  const options = loaderUtils.getOptions(loaderContext) || {}

  ...
  

  // 开始解析 sfc，根据不同的 block 来拆解对应的内容
  const descriptor = parse({
    source,
    compiler: options.compiler || loadTemplateCompiler(),
    filename,
    sourceRoot,
    needMap: sourceMap
  })

  // 如果 query 参数上带了 block 的 type 类型，那么会直接返回对应 block 的内容
  // 例如： foo.vue?vue&type=template，那么会直接返回 template 的文本内容
  if (incomingQuery.type) {
    return selectBlock(
      descriptor,
      loaderContext,
      incomingQuery,
      !!options.appendExtension
    )
  }

  ...

  // template
  let templateImport = `var render, staticRenderFns`
  let templateRequest
  if (descriptor.template) {
    const src = descriptor.template.src || resourcePath
    const idQuery = `&id=${id}`
    const scopedQuery = hasScoped ? `&scoped=true` : ``
    const attrsQuery = attrsToQuery(descriptor.template.attrs)
    const query = `?vue&type=template${idQuery}${scopedQuery}${attrsQuery}${inheritQuery}`
    const request = templateRequest = stringifyRequest(src + query)
    templateImport = `import { render, staticRenderFns } from ${request}`
  }

  // script
  let scriptImport = `var script = {}`
  if (descriptor.script) {
    const src = descriptor.script.src || resourcePath
    const attrsQuery = attrsToQuery(descriptor.script.attrs, 'js')
    const query = `?vue&type=script${attrsQuery}${inheritQuery}`
    const request = stringifyRequest(src + query)
    scriptImport = (
      `import script from ${request}\n` +
      `export * from ${request}` // support named exports
    )
  }

  // styles
  let stylesCode = ``
  if (descriptor.styles.length) {
    stylesCode = genStylesCode(
      loaderContext,
      descriptor.styles,
      id,
      resourcePath,
      stringifyRequest,
      needsHotReload,
      isServer || isShadow // needs explicit injection?
    )
  }

  let code = `
${templateImport}
${scriptImport}
${stylesCode}

/* normalize component */
import normalizer from ${stringifyRequest(`!${componentNormalizerPath}`)}
var component = normalizer(
  script,
  render,
  staticRenderFns,
  ${hasFunctional ? `true` : `false`},
  ${/injectStyles/.test(stylesCode) ? `injectStyles` : `null`},
  ${hasScoped ? JSON.stringify(id) : `null`},
  ${isServer ? JSON.stringify(hash(request)) : `null`}
  ${isShadow ? `,true` : ``}
)
  `.trim() + `\n`

  if (descriptor.customBlocks && descriptor.customBlocks.length) {
    code += genCustomBlocksCode(
      descriptor.customBlocks,
      resourcePath,
      resourceQuery,
      stringifyRequest
    )
  }

  ...

  // Expose filename. This is used by the devtools and Vue runtime warnings.
  code += `\ncomponent.options.__file = ${
    isProduction
      // For security reasons, only expose the file's basename in production.
      ? JSON.stringify(filename)
      // Expose the file's full path in development, so that it can be opened
      // from the devtools.
      : JSON.stringify(rawShortFilePath.replace(/\\/g, '/'))
  }`

  code += `\nexport default component.exports`
  console.log(code)
  return code
}
```

以上就是 vue-loader 的入口文件主要做的工作：对 vue sfc 进行 parse，获取每个 block 的相关内容。