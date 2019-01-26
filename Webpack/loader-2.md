## Webpack Loader 详解

上篇文章主要讲了 loader 的配置，匹配相关的机制。这篇主要会讲当一个 module 被创建之后，使用 loader 去处理这个 module 内容的流程机制。首先我们来总体的看下整个的流程：

module 创建成功 -> module.build 开始构建 -> 

在 module 一开始构建的过程中，首先会创建一个 loaderContext 对象，它和这个 module 是一一对应的关系，而这个 module 所使用的所有 loaders 都会共享这个 loaderContext 对象，每个 loader 执行的时候上下文就是这个 loaderContext 对象，所以可以在我们写的 loader 里面通过 this 来访问。

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

当 loaderContext 初始化完成后，开始调用 runLoaders 方法，这个时候进入到了 loaders 的执行阶段。runLoaders 方法是由[loader-runner](https://github.com/webpack/loader-runner)这个独立的 npm 包提供的方法，那我们就一起来看下 runLoaders 方法内部是如何运行的。

首先根据传入的参数完成进一步的处理，同时对于 loaderContext 对象上的属性做进一步的拓展：

```javascript
exports.runLoaders = function runLoaders(options, callback) {
  // read options
	var resource = options.resource || ""; // 模块的路径
	var loaders = options.loaders || []; // 模块所需要使用的 loaders
	var loaderContext = options.context || {}; // 在 normalModule 里面创建的 loaderContext
	var readResource = options.readResource || readFile;

	var splittedResource = resource && splitQuery(resource);
	var resourcePath = splittedResource ? splittedResource[0] : undefined; // 模块实际路径
	var resourceQuery = splittedResource ? splittedResource[1] : undefined; // 模块路径 query 参数
	var contextDirectory = resourcePath ? dirname(resourcePath) : null; // 模块的父路径

	// execution state
	var requestCacheable = true;
	var fileDependencies = [];
	var contextDependencies = [];

	// prepare loader objects
	loaders = loaders.map(createLoaderObject); // 处理 loaders TODO: 

  // 拓展 loaderContext 的属性
	loaderContext.context = contextDirectory;
	loaderContext.loaderIndex = 0; // 当前正在执行的 loader 索引
	loaderContext.loaders = loaders;
	loaderContext.resourcePath = resourcePath;
	loaderContext.resourceQuery = resourceQuery;
	loaderContext.async = null; // 异步 loader
  loaderContext.callback = null;

  ...

  // 需要被构建的模块路径，将 loaderContext.resource -> getter/setter
  // 例如 /abc/resource.js?rrr
  Object.defineProperty(loaderContext, "resource", {
		enumerable: true,
		get: function() {
			if(loaderContext.resourcePath === undefined)
				return undefined;
			return loaderContext.resourcePath + loaderContext.resourceQuery;
		},
		set: function(value) {
			var splittedResource = value && splitQuery(value);
			loaderContext.resourcePath = splittedResource ? splittedResource[0] : undefined;
			loaderContext.resourceQuery = splittedResource ? splittedResource[1] : undefined;
		}
  });

  // 构建这个 module 所有的 loader 及这个模块的 resouce 所组成的 request 字符串
  // 例如：/abc/loader1.js?xyz!/abc/node_modules/loader2/index.js!/abc/resource.js?rrr
	Object.defineProperty(loaderContext, "request", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
  });
  // 剩下还未被调用的 loader.normal 所组成的 request 字符串
	Object.defineProperty(loaderContext, "remainingRequest", {
		enumerable: true,
		get: function() {
			if(loaderContext.loaderIndex >= loaderContext.loaders.length - 1 && !loaderContext.resource)
				return "";
			return loaderContext.loaders.slice(loaderContext.loaderIndex + 1).map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
  });
  // TODO:
	Object.defineProperty(loaderContext, "currentRequest", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.slice(loaderContext.loaderIndex).map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
  });
  // TODO:
	Object.defineProperty(loaderContext, "previousRequest", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.slice(0, loaderContext.loaderIndex).map(function(o) {
				return o.request;
			}).join("!");
		}
  });
  // 获取当前正在执行的 loader 的query参数
  // 如果这个 loader 配置了 options 对象的话，this.query 就指向这个 option 对象
  // 如果 loader 中没有 options，而是以 query 字符串作为参数调用时，this.query 就是一个以 ? 开头的字符串
	Object.defineProperty(loaderContext, "query", {
		enumerable: true,
		get: function() {
			var entry = loaderContext.loaders[loaderContext.loaderIndex];
			return entry.options && typeof entry.options === "object" ? entry.options : entry.query;
		}
  });
  // 每个 loader 在 pitch 阶段和正常执行阶段都可以共享的 data 数据
	Object.defineProperty(loaderContext, "data", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders[loaderContext.loaderIndex].data;
		}
  });
  
  var processOptions = {
		resourceBuffer: null, // module 的内容 buffer
		readResource: readResource
  };
  // 开始执行每个 loader 上的 pitch 函数
	iteratePitchingLoaders(processOptions, loaderContext, function(err, result) {
    // do something...
  });
}
```

这里稍微总结下就是在 runLoaders 方法的初期会对相关参数进行初始化的操作，特别是将 loaderContext 上的部分属性改写为 getter/setter 函数，这样在不同的 loader 执行的阶段可以动态的获取一些参数。
