webpack 相关的一些个人总结

## module

webpack 当中的 module 的概念(可以理解为一个文件对应一个 module)：

是一个包含了这个文件的

1. request 路径

2. 所有loaders集合

3. parser (js编译器)

4. generator (module 生成器)

5. source (用以获取 module 文本内容的)

等相关 api 的集合，最终通过 `new NormalModule()` 类去创建对应的实例

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


fileDependencies / contextDependencies


一个 module 的 buildModule 的流程：

1. 首先进入 loaders 处理的流程；

2. parse 过程，在 parse 过程当中完成依赖的收集工作


----

_addModuleChain -> createModule -> processModuleDependencies (针对入口文件的处理)

processModuleDependencies -> addModuleDependencies (针对依赖 module 的处理)