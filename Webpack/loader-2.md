## Webpack Loader 详解

上篇文章主要讲了 loader 的配置，匹配相关的机制。这篇主要会讲当一个 module 被创建之后，使用 loader 去处理这个 module 的流程机制。首先我们来总体的看下整个的流程：

module 创建成功 -> module.build 开始构建 -> 

在 module 一开始构建的过程中，首先会创建一个 loaderContext 对象，它和这个 module 是一一对应的关系，而这个 module 所使用的所有 loaders 都会共享这个 loaderContext 对象，每个 loader 执行的时候上下文就是这个 loaderContext 对象。

```javascript
// NormalModule.js

const { runLoaders } = require('loader-runner')

class NormalModule extends Module {
  ...
  createLoaderContext(resolver, options, compilation, fs) {
    const requestShortener = compilation.runtimeTemplate.requestShortener;
    // 初始化 loaderContext 对象，这些初始字段的具体内容解释在文档上有具体的解释(https://webpack.docschina.org/api/loaders/#this-data)
		const loaderContext = {
			version: 2,
			emitWarning: warning => {...},
			emitError: error => {...},
			exec: (code, filename) => {...},
			resolve(context, request, callback) {...},
			getResolve(options) {...},
			emitFile: (name, content, sourceMap) => {...},
			rootContext: options.context, // 项目的根路径
			webpack: true,
			sourceMap: !!this.useSourceMap,
			_module: this,
			_compilation: compilation,
			_compiler: compilation.compiler,
			fs: fs
		};

    // 触发 normalModuleLoader 的钩子函数
		compilation.hooks.normalModuleLoader.call(loaderContext, this);
		if (options.loader) {
			Object.assign(loaderContext, options.loader);
		}

		return loaderContext;
  }

  doBuild(options, compilation, resolver, fs, callback) {
    // 创建 loaderContext 上下文
		const loaderContext = this.createLoaderContext(
			resolver,
			options,
			compilation,
			fs
    )
    
    runLoaders(
      {
        resource: this.resource, // 这个模块的路径
				loaders: this.loaders, // 模块所使用的 loaders
				context: loaderContext, // loaderContext 上下文
				readResource: fs.readFile.bind(fs) // 读取文件的 node api
      },
      (err, result) => {
        // do something
      }
    )
  }
  ...
}
```

当 loaderContext 初始化完成后，开始调用 runLoaders 方法，这个时候进入到了 loaders 的执行阶段。runLoaders 方法是由`loader-runner`这个独立的 npm 包提供的方法，那我们就一起来看下 runLoaders 方法内部是如何运行的。