## Some tips for Loader

### [Inline MatchResource](https://webpack.js.org/api/loaders/#thisimportmodule)

可以用来改造 module ext，使得原有的 resource 不走 module.rule 的匹配策略，而是根据 `!=!` 之前的 resource 进行 rule 匹配工作来选择使用对应的 loader。因此在 `!=!` 右侧经过 loader 处理后返回的内容会交给 `!=!` 之前经过 module rule 匹配到的 loader 做进一步的处理。

一般适用的场景就是一个 module 经过原有的 loader 处理后还需要其他的 loader 处理其对应的内容。

### Pitcher Loader

非常灵活的一个特性。因为是先于 loader 实际处理模块方法的执行，所以可以在 pitcher 阶段做一些其他的事情。

例如在 `vue-loader` 当中：

例如在 `mpx` 当中，利用 `extractor loader` 的 pitcher 阶段，通过 `importModule` 方法获取已经构造好的不同的 block 执行导出的内容来完成 template/style/json block 的抽离工作。

### [importModule](https://webpack.js.org/api/loaders/#thisimportmodule)


直接加载给定路径的 module，获取这个 module 被导出的内容，就相当于可以在一个模块的 loader 阶段起一个 childCompiler 去完成其他模块的编译工作，获取其他模块经过编译后导出(exports of module)的内容。


### [loadModule](https://webpack.js.org/api/loaders/#thisloadmodule)

直接加载给定路径的 module，最终可以获取到这个 module 经过完整编译流程处理后的 js module 代码。

```javascript
// module._source._value
loadModule(request: string, callback: function(err, source, sourceMap, module))
```


**`loadModule` 和 `importModule` 之间的区别在于 `loadModule` 获取到的这个模块本身经过编译构建后的代码，而 `importModule` 是可以获取这个 module 导出的内容。**

这2个方法都是在 `webpack/lib/dependencies/LoaderPlugin.js` 通过插件的形式在 loaderContext 上完成方法的注册。在这个模块的具体处理过程中，两个方法的差异也是在 importModule 在编译完这个模块结束后，获取对应的 js module，会继续执行 `compilation.excuteModule` 完成对于这个 js module 的执行，如果有导出内容的话，则会获取最终导出的内容。