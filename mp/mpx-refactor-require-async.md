## RuntimeModule 如何去工作的

从功能定位上来说，runtimeModule 一般是用以注入全局的运行时模块，给 `__webpack_require__` 这个函数上去挂载相关的方法。

然后在每个 module 内部可以通过 `__webpack_require__.xx` 方法去访问到注入的对应方法。

它的大致流程就是在处理每个 module 的依赖（dependency）生成代码的过程中，通过 `runtimeRequirements` 来添加需要注入的方法。

就拿异步加载的 chunk 来说，我们在源码当中通过 `import()` 异步语法来引入一个模块。

对于一个 module 需要使用运行时注入的方法都是在代码生成(codeGeneration)阶段，处理其依赖dependency 生成代码的过程中，如果有需要使用的运行时方法就可以通过 `runtimeRequirements` 去添加需要被注入的模块方法：

```javascript
ImportDependency.Template = class ImportDependencyTemplate extends (
  ModuleDependency.Template
) {
  apply (
    dependency,
    source,
    {
      runtimeTemplate, module, moduleGraph, chunkGraph, runtimeRequirements
    }
  ) {
    const dep = dependency
    const block = moduleGraph.getParentBlock(dep)

    const content = runtimeTemplate.moduleNamespacePromise({
      chunkGraph,
      block: block,
      module: moduleGraph.getModule(dep),
      request: dep.request,
      strict: module.buildMeta.strictHarmonyModule,
      message: 'import()',
      runtimeRequirements
    })

    source.replace(dep.range[0], dep.range[1] - 1, content)
  }
}
```

```javascript
class RuntimeTemplate {
  ...
  moduleNamespacePromise({
    chunkGraph,
    block,
    module,
    request,
    message,
    strict,
    weak,
    runtimeRequirements
  }) {
    ...
    const promise = this.blockPromise({
      chunkGraph,
      block,
      message,
      runtimeRequirements
    })
    ...
  }
  ...
  
  blockPromise() {
    ...
    if (chunks.length === 1) {
      ...
      runtimeRequirements.add(RuntimeGlobals.ensureChunk) // 添加需要的 ensureChunk 运行时模块
      return `${RuntimeGlobals.ensureChunk}(${comment}${chunkId})`
    } else if (chunks.length > 0) {
      runtimeRequirements.add(RuntimeGlobals.ensureChunk);
			const requireChunkId = chunk =>
				`${RuntimeGlobals.ensureChunk}(${JSON.stringify(chunk.id)})`;
			return `Promise.all(${comment.trim()}[${chunks
				.map(requireChunkId)
				.join(", ")}])`;
    }
    ...
  }
}
```

在 compilation codeGeneration 的回调当中（也就是对所有的 module dependency 处理完之后 sourceDependency）会依次遍历在之前处理每个 module dependency 所注入的所需要的运行时的模块内容 `processRuntimeRequirements`，通过 `hooks.runtimeRequirementInTree` 来动态的添加 `RuntimeModule`

```javascript
class Compilation {
  ...
  processRuntimeRequirements() {
    ...
    for (const r of set) {
      this.hooks.runtimeRequirementInTree
        .for(r)
        .call(treeEntry, set, context) // 第二个参数为 runtimeRequirements set 集合，在这个 hooks 触发的阶段可能会动态的往这个 set 当中新增运行时模块
    }
  }
}
```

```javascript
hooks.runtimeRequirementInTree
  .for(RuntimeGlobal.ensureChunkHandlers)
  .tap('JsonpChunkLoadingPlugin', (chunk, set) => {
    ...
    set.add(RuntimeGlobals.loadScript) // set -> runtimeRequirementInTree
  })
```

那么在 processRuntimeRequirements 的处理过程当中动态添加的 RuntimeModule，会放到下一轮的 `_runCodeGenerationJobs` 模块代码生成工作，专门处理在 processRuntimeRequirements 阶段所收集到的 RuntimeModule。

注意：在 compilation codeGeneration 第一次的处理过程当中仅处理 NormalModule 等实际的静态的 module，在这个阶段只是通过 hook api 完成 RuntimeModule 的收集工作，并没有完成对于 RuntimeModule 的代码生成处理，实际的 RuntimeModule 生成工作是在 codeGeneration 的回调当中进行第二次的 `_runCodeGenerationJobs` 所开启的代码生成 module.generate() 工作。