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

1. 遍历 module graph 模块依赖图建立起 basic chunks graph 依赖图；
2. 遍历第一步创建的 chunk graph 依赖图（TODO: 具体描述）

在第一个步骤中，首先对这次 compliation 收集到的 modules 进行一次遍历，在遍历 module 的过程中，会对这个 module 的 dependencies 依赖进行处理，获取这个 module 的依赖模块，同时还会处理这个 module 的 blocks(即在你的代码通过异步 API 加载的模块)，每个异步 block 都会被加入到遍历的过程当中，被当做一个 module 来处理。因此在这次遍历的过程结束后会建立起基本的 module graph，包含普通的 module 及异步 module(block)，最终存储到一个 map 结构当中：

```javascript
const iteratorBlockPrepare = b => {
  blockInfoBlocks.push(b);
  blockQueue.push(b);
};

for (const modules of this.modules) {
  blockQueue = [module];
  currentModule = module;
  while (blockQueue.length > 0) {
    block = blockQueue.pop();
    blockInfoModules = new Set();
    blockInfoBlocks = [];

    if (block.variables) {
      iterationBlockVariable(block.variables, iteratorDependency);
    }

    if (block.dependencies) {
      iterationOfArrayCallback(block.dependencies, iteratorDependency);
    }

    if (block.blocks) {
      iterationOfArrayCallback(block.blocks, iteratorBlockPrepare);
    }

    const blockInfo = {
      modules: Array.from(blockInfoModules), // 依赖的 modules
      blocks: blockInfoBlocks // 依赖的 blocks
    };
    // blockInfoMap 上保存了每个 module 的依赖 module 及 异步 blocks
    blockInfoMap.set(block, blockInfo);
  }
}
```

在我们的实例当中生成的 module graph 即为(TODO: module graph):

当基础的 module graph (即`blockInfoMap`)生成后，接下来开始根据 module graph 去生成 basic chunk graph，刚开始仍然是数据的处理，将传入的 entryPoint(chunkGroup) 转化为一个新的 queue，queue 数组当中每一项包含了：

* action (需要被处理的模块类型，不同的处理类型的模块会经过不同的流程处理，初始为 ENTER_MODULE(1))
* block (入口 module)
* module (入口 module)
* chunk (seal 阶段一开始为每个入口 module 创建的空 chunk)
* chunkGroup (entryPoint 即 chunkGroup 类型)

在我们提供的示例当中，因为是单入口的，因此这里 queue 初始化后只有一项。接下来进入到 queue 的遍历环节，首先根据 action 的类型进入到对应的处理流程当中：

首先进入到 ENTRY_MODULE 的阶段，会在 queue 中新增一个 action 为 LEAVE_MODULE 的项，在后面遍历的时候使用，当 ENTRY_MODULE 的阶段进行完后，立即进入到了 PROCESS_BLOCK 阶段：

首先根据 module graph 保存的模块映射 blockInfoMap 获取这个 module 的依赖 modules 及异步的 blocks，这里便会判断当前这个 module 所属的 chunk 当中是否包含了这个 module 的依赖，如果没有的话，那么会在 queue 当中加入新的项，新加入的项目的 action 为 ADD_AND_ENTER_MODULE，即这个项在下次遍历的时候，首先会进入到 ADD_AND_ENTER_MODULE 阶段。当新项被 push 至 queue 当中后，接下来开始调用`iteratorBlock`方法来处理这个 module 所依赖的所有的异步 blocks，在这个方法内部主要完成的工作是：

1. 调用`addChunkInGroup`为这个异步的 block 新建一个 chunk 以及 chunkGroup，同时调用 GraphHelpers 模块提供的 connectChunkGroupAndChunk 建立起这个新建的 chunk 和 chunkGroup 之间的联系。这里新建的 chunk 也就是在你的代码当中使用异步API 加载模块时，webpack 最终会单独给这个模块输出一个 chunk，但是这个 chunk 为一个空的 chunk，没有加入任何依赖的 module；

2. 建立起当前 module 所属的 chunkGroup 和 block 以及这个 block 所属的 chunkGroup 之间的依赖关系，并存储至 chunkDependencies map 表中；

3. 向 queue 中添加一个新项以供下一次的遍历。这个新项的 action 类型为 PROCESS_BLOCK，module 为当前所属的 module，block 为当前 module 依赖的异步模块，chunk 及 chunkGroup 都是处理异步模块生成的。

在 ENTRY_MODULE 阶段即完成了将 entry module 的依赖 module 加入到 queue 当中，这个阶段结束后即进入到了第二轮的 queue 遍历的环节：

而这一轮的遍历过程当中，我们主要关注 queue 当中每项 action 类型为 ADD_AND_ENTER_MODULE 的项，在进行实际的处理时，进入到 ADD_AND_ENTER_MODULE 阶段，这个阶段完成的主要工作就是判断 chunk 所依赖的 module 是否已经添加到 chunk 内部(`chunk.addModule`)，如果没有的话，那么便会将 module 加入到 chunk，并进入到 ENTRY_MODULE 阶段，进入到后面的流程(见上文)，如果已经添加过了，那么则会跳过这次遍历。

以上是在`processDependenciesBlocksForChunkGroups`方法内部对于 module graph 和 chunk graph 的初步处理，最终的结果就是根据 module graph 建立起了 chunk graph，将原本空的 chunk 里面加入其对应的 module 依赖。


```javascript
...
const ADD_AND_ENTER_MODULE = 0;
const ENTER_MODULE = 1;
const PROCESS_BLOCK = 2;
const LEAVE_MODULE = 3;
...
const chunkGroupToQueueItem = chunkGroup => ({
  action: ENTER_MODULE,
  block: chunkGroup.chunks[0].entryModule,
  module: chunkGroup.chunks[0].entryModule,
  chunk: chunkGroup.chunks[0],
  chunkGroup
});

let queue = inputChunkGroups.map(chunkGroupToQueueItem).reverse()

while (queue.length) {
  while (queue.length) {
    const queueItem = queue.pop();
    module = queueItem.module;
    block = queueItem.block;
    chunk = queueItem.chunk;
    chunkGroup = queueItem.chunkGroup;

    switch (queueItem.action) {
      case ADD_AND_ENTER_MODULE: {
        // 添加 module 至 chunk 当中
        // We connect Module and Chunk when not already done
        if (chunk.addModule(module)) {
          module.addChunk(chunk);
        } else {
          // already connected, skip it
          break;
        }
      }
      // fallthrough
      case ENTER_MODULE: {
        ...
        queue.push({
          action: LEAVE_MODULE,
          block,
          module,
          chunk,
          chunkGroup
        });
      }
      // fallthrough
      case PROCESS_BLOCK: {
        // get prepared block info
        const blockInfo = blockInfoMap.get(block);
        // Traverse all referenced modules
        for (let i = blockInfo.modules.length - 1; i >= 0; i--) {
          const refModule = blockInfo.modules[i];
          if (chunk.containsModule(refModule)) {
            // skip early if already connected
            continue;
          }
          // enqueue the add and enter to enter in the correct order
          // this is relevant with circular dependencies
          queue.push({
            action: ADD_AND_ENTER_MODULE,
            block: refModule, // 依赖 module
            module: refModule, // 依赖 module
            chunk, // module 所属的 chunk
            chunkGroup // module 所属的 chunkGroup
          });
        }

        // 开始创建异步的 chunk
        // Traverse all Blocks
        iterationOfArrayCallback(blockInfo.blocks, iteratorBlock);

        if (blockInfo.blocks.length > 0 && module !== block) {
          blocksWithNestedBlocks.add(block);
        }
        break;
      }
      case LEAVE_MODULE: {
        ...
        break;
      }
    }
  }
  const tempQueue = queue;
  queue = queueDelayed.reverse();
  queueDelayed = tempQueue;
}
```