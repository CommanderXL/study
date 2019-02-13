## Chunk

一些概念及其相互之间的关系：

1. chunkGroup
2. chunk
3. module

我们都知道 webpack 打包构建时会根据你的具体业务代码和 webpack 相关配置来决定输出的最终文件，具体的文件的名和文件数量也与此相关。而这些文件就被称为 chunk。例如在你的业务当中使用了异步分包的 API：

```javascript
import('./foo.js').then(bar => bar())
```

在最终输出的文件当中，`foo.js`会被单独输出一个 chunk 文件。

又或者在你的 webpack 配置当中，进行了有关 optimization 优化 chunk 生成的配置：

```javascript
module.exports = {
  optimization: {
    runtimeChunk: {
      name: 'runtime-chunk'
    }
  }
}
```

最终 webpack 会将 webpack runtime chunk 单独抽离成一个 chunk 后再输出成一个名为`runtime-chunk.js`的文件。

而这些生成的 chunk 文件当中即是由相关的 module 模块所构成的。接下来我们就看下 webpack 在工作流当中是如何生成 chunk 的。

在 webpack 的工作流程当中，当所有的 module 都被编译完成后，进入到 seal 阶段会开始生成 chunk 的相关的工作：

```javascript
// compilation.js

class Compilation {
  ...
  seal () {
    ...
    this.hooks.beforeChunks.call();
		// 根据 addEntry 方法中收集到入口文件组成的 _preparedEntrypoints 数组
		for (const preparedEntrypoint of this._preparedEntrypoints) {
			const module = preparedEntrypoint.module;
			const name = preparedEntrypoint.name;
			const chunk = this.addChunk(name); // 入口 chunk 且为 runtimeChunk
			const entrypoint = new Entrypoint(name); // 每一个 entryPoint 就是一个 chunkGroup
			entrypoint.setRuntimeChunk(chunk); // 设置 runtime chunk
			entrypoint.addOrigin(null, name, preparedEntrypoint.request);
			this.namedChunkGroups.set(name, entrypoint); // 设置 chunkGroups 的内容
			this.entrypoints.set(name, entrypoint);
			this.chunkGroups.push(entrypoint);

			// 建立起 chunkGroup 和 chunk 之间的关系
			GraphHelpers.connectChunkGroupAndChunk(entrypoint, chunk);
			// 建立起 chunk 和 module 之间的关系
			GraphHelpers.connectChunkAndModule(chunk, module);

			chunk.entryModule = module;
			chunk.name = name;

			this.assignDepth(module);
		}
		this.processDependenciesBlocksForChunkGroups(this.chunkGroups.slice());
		// 对 module 进行排序
		this.sortModules(this.modules);
		// 创建完 chunk 之后的 hook
		this.hooks.afterChunks.call(this.chunks);
		//
		this.hooks.optimize.call();

		while (
			this.hooks.optimizeModulesBasic.call(this.modules) ||
			this.hooks.optimizeModules.call(this.modules) ||
			this.hooks.optimizeModulesAdvanced.call(this.modules)
		) {
			/* empty */
		}
		// 优化 module 之后的 hook
		this.hooks.afterOptimizeModules.call(this.modules);
		while (
			this.hooks.optimizeChunksBasic.call(this.chunks, this.chunkGroups) ||
			this.hooks.optimizeChunks.call(this.chunks, this.chunkGroups) ||
			// 主要涉及到 webpack config 当中的有关 optimization 配置的相关内容
			this.hooks.optimizeChunksAdvanced.call(this.chunks, this.chunkGroups)
		) {
			/* empty */
		}
		// 优化 chunk 之后的 hook
		this.hooks.afterOptimizeChunks.call(this.chunks, this.chunkGroups);
    ...
  }
  ...
}
```

在这个过程当中首先遍历 webpack config 当中配置的入口 module，每个入口 module 都会通过`addChunk`方法去创建一个 chunk，而这个新建的 chunk 为一个空的 chunk，即不包含任何与之相关联的 module。之后实例化一个 entryPoint，而这个 entryPoint 为一个 chunkGroup，每个 chunkGroup 包含多的 chunk，同时内部会有个比较特殊的 runtimeChunk（TODO:）。到此仅仅是分别创建了 chunk 以及 chunkGroup，接下来便调用`GraphHelpers`模块提供的`connectChunkGroupAndChunk`及`connectChunkAndModule`方法来建立起 chunkGroup 和 chunk 之间的联系，以及 chunk 和 **入口 module** 之间(这里还未涉及到依赖 module)的联系。(TODO: 提及这2个方法内部的工作原理)

例如我们给的示例当中，入口 module 只配置了一个，那么进入到上面提到的这个阶段时会生成一个 chunkGroup 以及 一个 chunk，这个 chunk 目前仅仅只包含了入口 module。我们都知道 webpack 输出的 chunk 当中都会包含与之相关的 module，在编译环节进行到上面这一步仅仅建立起了 chunk 和入口 module 之间的联系，那么 chunk 是如何与其他的 module 也建立起联系呢？接下来我们就看下 webpack 在生成 chunk 的过程当中是如何与其依赖的 module 进行关联的。

与此相关的便是 compilation 实例提供的`processDependenciesBlocksForChunkGroups`方法。由于这个方法内部细节较为复杂，因此这里会梳理其核心的流程：

1. 遍历 module graph 模块依赖图建立起 very basic chunks graph 依赖图；
2. 遍历第一步创建的 chunk graph 依赖图（TODO: 具体描述）

在第一个步骤中，首先对这次 compliation 收集到的 modules 进行一次遍历，且遍历了与每个 module 相关的异步 blocks，在这次遍历当中主要是建立起基本的 module graph。在我们的实例当中生成的 module graph 即为(TODO: module graph):