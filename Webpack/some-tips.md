webpack 相关的一些个人总结

## module

通过一个 request 路径去构造一个 module

webpack 当中的 module 的概念(可以理解为一个文件对应一个 module)：

是一个包含了这个文件的

1. request 路径

2. 所有 loaders 集合

3. parser (js 编译器)

4. generator (module 生成器)

5. source (用以获取 module 文本内容的)

6. dependencies (只有这个 module 经过 parse 后才完成依赖的收集工作)

7. buildInfo 记录了有关 module 编译过程中收集的信息（依赖关系（用以持久化缓存的判断）、也会往 buildInfo 上挂载需要输出的 assets 文件内容，具体见 emitFile 方法），一般对于一个 module 来说除了本身处理为一个 js 资源外，如果想输出一些其他的文本资源都是可以通过 emitFile api 来往 buildInfo 上挂载相关的数据。

```javascript
// lib/NormalModule.js

build(options, compilation, resolver, fs, callback) {
  this.buildInfo = {
    cacheable: false,
    parsed: true,
    fileDependencies: undefined
    contextDependencies: undefined,
    missingDependencies: undefined, // 不需要关注的依赖
  }
}

emitFile(name, content, sourceMap, assetInfo) {
  // buildInfo.assets 保存了需要被输出的静态资源的内容
  // buildInfo.assetsInfo 保存了需要被输出内容的额外的信息，也意味着可以挂载不同的自定义信息
  if (!this.buildInfo.assets) {
    this.buildInfo.assets = Object.create(null)
    this.buildInfo.assetsInfo = new Map()
  }

  this.buildInfo.assets[name] = this.createSourceForAsset(
    options.context,
    name,
    content,
    sourceMap,
    compilation.compiler.root
  )
  
  this.buildInfo.assetsInfo.set(name, assetInfo)
}
```



等相关 api 的集合。这些基础的属性定义在 `NormalModule.js` 类当中，不过 `NormalModule` 也继承了其他的类，这些基类同时也提供了一些额外的属性定义，例如继承的 `Module` 类，`DependenciesBlock` 类，其中 `DependenciesBlock` 提供了一些关键的依赖相关的属性：

```javascript
class DependenciesBlock {
  constructor() {
    /** @type {Dependency[]} */
    this.dependencies = []
    /** @type {AsyncDependenciesBlock[]} */
    this.blocks = []
    /** @type {DependenciesBlockVariable[]} */
    this.variables = []
  }
}
```

最终通过 `new NormalModule()` 类去创建对应的实例

```javascript
// 通过
this.hooks.afterResolve.callAsync(data, (err, result) {
  ...
  let createdModule = this.hooks.createModule.call(result)

  if (!createdModule) {
    createdModule = new NormalModule(result)
  }
})
```

module 有一个 create 的过程，主要是通过文件的路径以及 ModuleFactory 进行 create。

create module 之后，通过 `this.addModule(module)` 方法来给 compilation 添加模块缓存。如果缓存里面已经存在这个已经被编译过的 module，且满足缓存的条件，那么这个模块最终不会走 buildModule 的流程，而是将这个 module 直接返回。

```javascript
/**
 * @typedef {Object} AddModuleResult
 * @property {Module} module the added or existing module
 * @property {boolean} issuer was this the first request for this module
 * @property {boolean} build should the module be build
 * @property {boolean} dependencies should dependencies be walked
 */

/**
 * @param {Module} module module to be added that was created
 * @param {any=} cacheGroup cacheGroup it is apart of
 * @returns {AddModuleResult} returns meta about whether or not the module had built had an issuer, or any dependnecies
 */
addModule(module, cacheGroup) {
  // identifier 就是这个 module 的路径
  const identifier = module.identifier();
		// 是否是已经被编译过的 module 依赖
  const alreadyAddedModule = this._modules.get(identifier);
  if (alreadyAddedModule) {
    return {
      module: alreadyAddedModule,
      issuer: false,
      build: false,
      dependencies: false
    };
  }
  const cacheName = (cacheGroup || "m") + identifier;
  if (this.cache && this.cache[cacheName]) {
    const cacheModule = this.cache[cacheName];

    if (typeof cacheModule.updateCacheModule === "function") {
      cacheModule.updateCacheModule(module);
    }

    let rebuild = true;
    if (this.fileTimestamps && this.contextTimestamps) {
      rebuild = cacheModule.needRebuild(
        this.fileTimestamps,
        this.contextTimestamps
      );
    }

    // 不需要重新编译的话就直接返回
    if (!rebuild) {
      // disconnect 方法主要是用于清除当前模块的 issuer 关系，以及其依赖的模块的 issuer 关系
      cacheModule.disconnect();
      this._modules.set(identifier, cacheModule);
      this.modules.push(cacheModule);
      for (const err of cacheModule.errors) {
        this.errors.push(err);
      }
      for (const err of cacheModule.warnings) {
        this.warnings.push(err);
      }
      // 直接返回缓存的模块，issuer 置为 true，则在外部会重新设定模块的 issuer 关系
      return {
        module: cacheModule,
        issuer: true,
        build: false,
        dependencies: true
      };
    }
    // 如果缓存模块需要重新编译的话，调用 unbuild() 方法来清空这个缓存模块的所有依赖
    // 以及编译相关的信息(buildInfo)然后走重新编译的流程
    cacheModule.unbuild();
    module = cacheModule;
  }
  this._modules.set(identifier, module);
  if (this.cache) {
    this.cache[cacheName] = module;
  }
  this.modules.push(module);
  return {
    module: module,
    issuer: true,
    build: true,
    dependencies: true
  };
}
```

！！！module.needRebuild() 方法用以 timestamp 的文件改变的判断准则

一个 module 经由 loaders 处理过后，将会得到非常重要的配置信息：`fileDependencies`、`contextDependencies` 用以作为 **module 是否还需要重新被 loaders 处理的缓存策略信息**。

loader 的缓存策略：

1. 经过 loader 处理后的文件，会在 module.buildInfo 上挂载相关的配置信息：

```javascript
class NormalModule extends Module {
  ...
  build(options, compilation, resolver, fs, callback) {
    ...
    // 记录这个模块经过 loader / parser 处理后的相关信息
    this.buildInfo = {
      cacheable: false,
      fileDependencies: new Set(),
      contextDependencies: new Set()
    }
  }

  needRebuild(fileTimestamps, contextTimestamps) {
		// always try to rebuild in case of an error
		if (this.error) return true;

		// always rebuild when module is not cacheable
		if (!this.buildInfo.cacheable) return true;

		// Check timestamps of all dependencies
		// Missing timestamp -> need rebuild
		// Timestamp bigger than buildTimestamp -> need rebuild
		for (const file of this.buildInfo.fileDependencies) {
			const timestamp = fileTimestamps.get(file);
			if (!timestamp) return true;
			if (timestamp >= this.buildTimestamp) return true;
		}
		for (const file of this.buildInfo.contextDependencies) {
			const timestamp = contextTimestamps.get(file);
			if (!timestamp) return true;
			if (timestamp >= this.buildTimestamp) return true;
		}
		// elsewise -> no rebuild needed
		return false;
	}
}
```

2.

watchpack 提供了 timestamps 的 map 结构，用来缓存文件编译相关的信息

fileDependencies(文件路径) / contextDependencies(文件目录路径)

一个 module 的 buildModule 的流程：

1. 首先进入 loaders 处理的流程，在此阶段可以对于源码做各种侵入性的改造，但是最终所要达到的效果就是经过 loaders 处理后的代码能交由 parser 进行编译处理；

2. parse 过程，在 parse 过程当中完成依赖的收集工作。

---

\_addModuleChain -> createModule -> processModuleDependencies (针对入口文件的处理)

processModuleDependencies -> addModuleDependencies (针对依赖 module 的处理)

在 addModuleDependencies 方法当中针对多个依赖项(`['dependencyA', 'dependencyB', 'dependencyC']`)是一个**`并行`**的异步流程([asyncLib.forEach](https://caolan.github.io/async/v3/docs.html#eachOf))：

```javascript
/*

Tips: 因此不同依赖之间的处理时机是没有严格的时序保证的

*/
addModuleDependencies(
  module,
  dependencies,
  bail,
  cacheGroup,
  recursive,
  callback
) {
  // forEach 并行
  asyncLib.forEach(
    dependencies,
    (item, callback) => {
      // 异步处理流程
    },
    err => {
      if (err) {
        // do something
      }
      return process.nextTick(callback)
    }
  )
}
```

在 module 的开始构建流程当中，会添加几个比较重要的属性：

```javascript
build(options, compilation, resolver, fs, callback) {
  this.buildTimestamp = Date.now();
  this.built = true;
  this._source = null; // 源码属性
  this._ast = null; // ast 结构
  this._buildHash = "";
  this.error = null;
  this.errors.length = 0;
  this.warnings.length = 0;
  this.buildMeta = {};
  // 记录这个模块经过 loader / parser 处理后的相关信，这个 module 相关的 fileDependencies/contextDependencies 依赖
  this.buildInfo = {
    cacheable: false,
    fileDependencies: new Set(),
    contextDependencies: new Set()
  };
}
```


### createModuleAssets 

生成需要通过这个 module 产出的额外的 asset 资源内容； 

emitFile 保存文件内容
createAssets 输出文件内容


emitAsset 产出文件文本内容，这些文本内容都是通过 emitFile api 在 buildInfo 上挂载的内容；
---

## Resolver

ResolverFactory


## Dependency

Dependency 依赖

`class EntryDependency extends ModuleDependency` 模板依赖包含了一个 module 的 request 路径

**Dependency 和 Module 之间的区别？**

Module -> Dependency <-> DependencyFactory -> Module

在处理 Module 的过程中，Dependency 是相对于 Module 而言的，也就是对于这个 Module 而言所产生依赖关系抽象为 Dependency，其实也就是一个**索引**用来标记被依赖的 module。

既然 Dependency 是一个索引指向了实际对应的模块。那么在 webpack 的编译构建流程当中进入到处理这个 Dependency 的过程后实际也就是处理 Module

Dependency 记录了依赖的路径和它的 parentModule(即哪个模块对它的依赖)。

`compilation.chunkGraph` 提供了一系列有关 chunk 和其所包含的 module 之间的操作API：

```javascript
compilation.chunkGraph.isModuleInChunk
compilation.chunkGraph.disconnectChunkAndModule // 解除 module 和 chunk 之间的关系，最终 module 不会输出到 chunk 里面
compilation.chunkGraph.connectChunkAndModule // 建立 module 和 chunk 之间的关系
compilation.chunkGraph.setModuleId // 手动设置 chunk 当中的 module 对应的 id 值
```

## webpack5 编译构建流程

```javascript
// EntryPlugin.js
const { entry, options, context } = this
const dep = EntryPlugin.createDependency(entry, options)

compiler.hooks.make.tapAsync('EntryPlugin', (compilation, callback) => {
  compilation.addEntry(context, dep, options, (err) => {
    callback(err)
  })
})
```

```javascript
// compilation.js
_addModuleItem

addModuleTree({ context, dependency, contextInfo })

// 创建 module
handleModuleCreation()

// 通过 ModuleFactory 创建 module 实例
factorizeModule()

// 将创建好的 module 加入到建立 moduleGrouph 的流程当中
// 在这个过程当中会根据 module identifier 来判断是从缓存当中获取 module 实例
addModule()

// 建立起 module 和 dependency 之间的联系，建立部分 moduleGraph
moduleGraph.setResolvedModule()

// 开始 buildModule，完成后在回调里面开始处理对应的依赖
_handleModuleBuildAndDependencies()

// 处理模块依赖，用以创建新的模块
processModuleDependencies(module)
```

## moduleGraph、chunk、chunkGraph、chunkGroup

moduleGraph 实际是用来管理 module 与相关 dependency 之间的依赖的抽象

```javascript
this._moduleMap = new Map() // Map<module, ModuleGroupModules>
```

moduleGraphModule 是对于 module 相关信息的封装，用来记录 module 的一些依赖关系
