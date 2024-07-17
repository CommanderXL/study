

首先从概念和用途上有个直观的感受就是 `resolver` 实例提供了供你寻址的一些方法来解析文件路径，找到对应的文件地址。

在 webpack 整个技术架构当中，将寻址的功能单独抽离了一个 package：`enhance-resolve`。 webpack 将 `enhance-resolve` 作为底层的能力，上层封装了 `ResolverFactory` 来实例化具体的 `resolver` 对象。

```javascript
// lib/ResolverFactory.js
const Factory = require('enhanced-resolve').ResolverFactory

module.exports = class ResolverFactory {
  ...
  get(type, resolveOptions) {
    ...
    const newResolver = this._create(type, resolveOptions)
    ...
    return newResolver
  }

  _create(type, resolveOptionsWithDepType) {
    ...
    const resolver = Factory.createResolver(resolveOptions) // 创建 resolver 实例
    ...
    this.hooks.resolver
      .for(type)
      .call(resolver, resolveOptions, originalResolveOptions)
    return resolver
  }
}
```

resolver 从类型上区分一共有3种（**它们之间的区别主要是在解析的配置不同，解析配置不同对应的 resolver 功能和行为也有比较大的不同**，但是寻址的流程，也就是 enhance-resolve 的流程是一致的）：

* normal resolver
* context resolver
* loader resolver

### createResolver

创建 resolver 实例的过程当中，一方面是解析配置，这些配置也决定了当前这个 resolver 的功能和行为。

此外，就是在 resolver 实例上初始化一系列的 hook 以及内置 resolver 插件和外部传入的插件：

```javascript
exports.createResolver = function(options) {
  const normalizedOptions = createOptions(options)
  ...

  const plugins = userPlugins.slice()

  const resolver = customResolver
    ? customResolver
    : new Resolver(fileSystem, normalizedOptions)

  resolver.ensureHook('resolve')
  resolver.ensureHook('internalResolve')
  ....

  // 内置插件的初始化
  plugins.push(
    new DescriptionFilePlugin(
      'undescribed-resolve-in-package',
      descriptionFiles,
      false,
      'resolve-in-package'
    )
  )

  ...
  plugins.push(
    new NextPlugin('resolve-in-package', 'resolve-in-existing-directory')
  )
  ...

  // 外部插件的初始化
  for (const plugin of plugins) {
    if (typeof plugin === 'function') {
      (plugin).call(resolver, resolver)
    } else if (plugin) {
      plugin.apply(resolver)
    }
  }

  return resolver
}
```

初始化 resolver 实例后，调用  `resolver.resolve` 方法会正式开启寻址的流程。

```javascript
/**
* @param {object} context context information object
* @param {string} path context path
* @param {string} request request string
* @param {ResolveContext} resolveContext resolve context
* @param {ResolveCallback} callback callback function
* @returns {void}
*/
resolve(context, path, request, resolveContext, callback)
```

### 插件设计


### 流程设计

先后优先顺序的调度规则

before-xxx hook
after-xxx hook