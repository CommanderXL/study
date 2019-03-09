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

而这些生成的 chunk 文件当中即是由相关的 module 模块所构成的。

接下来我们就看下 webpack 在工作流当中是如何生成 chunk 的，首先我们先来看下示例：

```javascript
// a.js (webpack config 入口文件)
import add from './b.js'

add(1, 2)

import('./c').then(del => del(1, 2))

-----

// b.js
import mod from './d.js'

export default function add(n1, n2) {
  return n1 + n2
}

mod(100, 11)

-----

// c.js
import mod from './d.js'

mod(100, 11)

import('./b.js').then(add => add(1, 2))

export default function del(n1, n2) {
  return n1 - n2
}

-----

// d.js
export default function mod(n1, n2) {
  return n1 % n2
}
```

webpack 相关的配置：

```javascript

// webpack.config.js
module.exports = {
  entry: {
    app: 'a.js'
  },
  output: {
    filename: '[name].[chunkhash].js',
    chunkFilename: '[name].bundle.[chunkhash:8].js',
    publicPath: '/'
  },
  optimization: {
    runtimeChunk: {
      name: 'bundle'
    }
  },
}
```

不同模块之间的依赖关系可以通过下图来表示：

TODO: 补一个依赖关系图

其中 a.js 为 webpack config 当中配置的 entry 入口文件，b.js 作为 a.js 依赖的模块(dependencies)，c.js 作为 a.js 依赖的异步模块(blocks)。最终通过 webpack 编译后，将会生成3个 chunk 文件：

// TODO: 生成的3个 chunk 文件。以及每个 chunk 文件内部包含的具体的内容

接下来我们就通过源码来看下 webpack 内部是通过什么样的策略去完成 chunk 的生成的。

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

在这个过程当中首先遍历 webpack config 当中配置的入口 module，每个入口 module 都会通过`addChunk`方法去创建一个 chunk，而这个新建的 chunk 为一个空的 chunk，即不包含任何与之相关联的 module。之后实例化一个 entryPoint，而这个 entryPoint 为一个 chunkGroup，每个 chunkGroup 可以包含多的 chunk，同时内部会有个比较特殊的 runtimeChunk(当 webpack 最终编译完成后包含的 webpack runtime 代码最终会注入到 runtimeChunk 当中)。到此仅仅是分别创建了 chunk 以及 chunkGroup，接下来便调用`GraphHelpers`模块提供的`connectChunkGroupAndChunk`及`connectChunkAndModule`方法来建立起 chunkGroup 和 chunk 之间的联系，以及 chunk 和 **入口 module** 之间(这里还未涉及到依赖 module)的联系：

```javascript
// GraphHelpers.js

/**
 * @param {ChunkGroup} chunkGroup the ChunkGroup to connect
 * @param {Chunk} chunk chunk to tie to ChunkGroup
 * @returns {void}
 */
GraphHelpers.connectChunkGroupAndChunk = (chunkGroup, chunk) => {
	if (chunkGroup.pushChunk(chunk)) {
		chunk.addGroup(chunkGroup);
	}
};

/**
 * @param {Chunk} chunk Chunk to connect to Module
 * @param {Module} module Module to connect to Chunk
 * @returns {void}
 */
GraphHelpers.connectChunkAndModule = (chunk, module) => {
	if (module.addChunk(chunk)) {
		chunk.addModule(module);
	}
};
```

例如在示例当中，入口 module 只配置了一个，那么在处理 entryPoints 阶段时会生成一个 chunkGroup 以及 一个 chunk，这个 chunk 目前仅仅只包含了入口 module。我们都知道 webpack 输出的 chunk 当中都会包含与之相关的 module，在编译环节进行到上面这一步仅仅建立起了 chunk 和入口 module 之间的联系，那么 chunk 是如何与其他的 module 也建立起联系呢？接下来我们就看下 webpack 在生成 chunk 的过程当中是如何与其依赖的 module 进行关联的。

与此相关的便是 compilation 实例提供的`processDependenciesBlocksForChunkGroups`方法。这个方法内部细节较为复杂，它包含了两个核心的处理流程：

1. 遍历 module graph 模块依赖图建立起 basic chunk graph 依赖图；
2. 遍历第一步创建的 chunk graph 依赖图，依据之前的 module graph 来优化 chunk graph(由于 chunk graph 是 webpack 最终输出 chunk 的依据，在这一步的处理流程当中会剔除到一些 chunk graph 重复被创建的 chunk)

### 依据 module graph 建立 chunk graph

在第一个步骤中，首先对这次 compliation 收集到的 modules 进行一次遍历，在遍历 module 的过程中，会对这个 module 的 dependencies 依赖进行处理，获取这个 module 的依赖模块，同时还会处理这个 module 的 blocks(即在你的代码通过异步 API 加载的模块)，每个异步 block 都会被加入到遍历的过程当中，被当做一个 module 来处理。因此在这次遍历的过程结束后会建立起基本的 module graph，包含普通的 module 及异步 module(block)，最终存储到一个 map 表(blockInfoMap)当中：

```javascript
const iteratorBlockPrepare = b => {
  blockInfoBlocks.push(b);
  // 将 block 加入到 blockQueue 当中，从而进入到下一次的遍历过程当中
  blockQueue.push(b);
};

// 这次 compilation 包含的所有的 module
for (const modules of this.modules) {
  blockQueue = [module];
  currentModule = module;
  while (blockQueue.length > 0) {
    block = blockQueue.pop(); // 当前正在被遍历的 module
    blockInfoModules = new Set(); // module 依赖的同步的 module
    blockInfoBlocks = []; // module 依赖的异步 module(block)

    if (block.variables) {
      iterationBlockVariable(block.variables, iteratorDependency);
    }

    // 在 blockInfoModules 数据集(set)当中添加 dependencies 中的普通 module
    if (block.dependencies) {
      iterationOfArrayCallback(block.dependencies, iteratorDependency);
    }

    // 在 blockInfoBlocks 和 blockQueue 数组当中添加异步 module(block)，这样这些被加入到 blockQueue当中的
    // module 也会进入到遍历的环节，去获取异步 module(block)的依赖
    if (block.blocks) {
      iterationOfArrayCallback(block.blocks, iteratorBlockPrepare);
    }

    const blockInfo = {
      modules: Array.from(blockInfoModules),
      blocks: blockInfoBlocks
    };
    // blockInfoMap 上保存了每个 module 依赖的同步 module 及 异步 blocks
    blockInfoMap.set(block, blockInfo);
  }
}
```
在我们的实例当中生成的 module graph 即为(TODO: module graph):


当基础的 module graph (即`blockInfoMap`)生成后，接下来开始根据 module graph 去生成 basic chunk graph。刚开始仍然是数据的处理，将传入的 entryPoint(chunkGroup) 转化为一个新的 queue，queue 数组当中每一项包含了：

* action (需要被处理的模块类型，不同的处理类型的模块会经过不同的流程处理，初始为 ENTER_MODULE(1))
* block (入口 module)
* module (入口 module)
* chunk (seal 阶段一开始为每个入口 module 创建的空 chunk)
* chunkGroup (entryPoint 即 chunkGroup 类型)

在我们提供的示例当中，因为是单入口的，因此这里 queue 初始化后只有一项。

```javascript
{
  action: ENTER_MODULE,
  block: a.js,
  module: a.js,
  chunk,
  chunkGroup: entryPoint
}
```

接下来进入到 queue 的遍历环节，通过源码我们发现对于 queue 的处理进行了**2次遍历的操作（内层和外层）**，具体为什么会需要进行2次遍历操作后文会说明。首先我们来看下内层的遍历操作，首先根据 action 的类型进入到对应的处理流程当中：

首先进入到 ENTRY_MODULE 的阶段，会在 queue 中新增一个 action 为 LEAVE_MODULE 的项会在后面遍历的流程当中使用，当 ENTRY_MODULE 的阶段进行完后，立即进入到了 PROCESS_BLOCK 阶段：

在这个阶段当中根据 module graph 依赖图保存的模块映射 blockInfoMap 获取这个 module（称为A） 的同步依赖 modules 及异步依赖 blocks。

接下来遍历 modules 当中的包含的 module（称为B），判断当前这个 module(A) 所属的 chunk 当中是否包含了其依赖 modules 当中的 module(B)，如果不包含的话，那么会在 queue 当中加入新的项，新加入的项目的 action 为 ADD_AND_ENTER_MODULE，即这个新增项在下次遍历的时候，首先会进入到 ADD_AND_ENTER_MODULE 阶段。

当新项被 push 至 queue 当中后，即这个 module 依赖的还未被处理的 module(A) 被加入到 queue当中后，接下来开始调用`iteratorBlock`方法来处理这个 module(A) 依赖的所有的异步 blocks，在这个方法内部主要完成的工作是：

1. 调用`addChunkInGroup`为这个异步的 block 新建一个 chunk 以及 chunkGroup，同时调用 GraphHelpers 模块提供的 connectChunkGroupAndChunk 建立起这个新建的 chunk 和 chunkGroup 之间的联系。这里新建的 chunk 也就是在你的代码当中使用异步API 加载模块时，webpack 最终会单独给这个模块输出一个 chunk，但是此时这个 chunk 为一个空的 chunk，没有加入任何依赖的 module；

2. 建立起当前 module 所属的 chunkGroup 和 block 以及这个 block 所属的 chunkGroup 之间的依赖关系，并存储至 chunkDependencies map 表中，这个 map 表主要用于后面优化 chunk graph；

3. 向 queueDelayed 中添加一个 action 类型为 PROCESS_BLOCK，module 为当前所属的 module，block 为当前 module 依赖的异步模块，chunk(chunkGroup 当中的第一个 chunk) 及 chunkGroup 都是处理异步模块生成的新项，而这里向 queueDelayed 数据集当中添加的新项主要就是用于 queue 的外层遍历。

在 ENTRY_MODULE 阶段即完成了将 entry module 的依赖 module 加入到 queue 当中，这个阶段结束后即进入到了 queue 内层第二轮的遍历的环节：

在对 queue 的内层遍历过程当中，我们主要关注 queue 当中每项 action 类型为 ADD_AND_ENTER_MODULE 的项，在进行实际的处理时，进入到 ADD_AND_ENTER_MODULE 阶段，这个阶段完成的主要工作就是判断 chunk 所依赖的 module 是否已经添加到 chunk 内部(`chunk.addModule`方法)，如果没有的话，那么便会将 module 加入到 chunk，并进入到 ENTRY_MODULE 阶段，进入到后面的流程(见上文)，如果已经添加过了，那么则会跳过这次遍历。

当对 queue 这一轮的内层的遍历完成后(每一轮的内层遍历都对应于同一个 chunkGroup，即每一轮内层的遍历都是对这个 chunkGroup 当中所包含的所有的 module 进行处理)，开始进入到外层的遍历当中，即对 queueDelayed 数据集进行处理。

以上是在`processDependenciesBlocksForChunkGroups`方法内部对于 module graph 和 chunk graph 的初步处理，最终的结果就是根据 module graph 建立起了 chunk graph，将原本空的 chunk 里面加入其对应的 module 依赖。

chunkGroup1 包含了 a, b, d 3个 module，而 a 的异步依赖模块 c 以及 c 的同步依赖模块 d 同属于新创建的 chunkGroup2，chunkGroup2 中只有一个 chunk，而 c 的异步模块 b 属于新创建的 chunkGroup3。

TODO: 插入 chunk graph


```javascript
// 创建异步的 block
// For each async Block in graph
/**
 * @param {AsyncDependenciesBlock} b iterating over each Async DepBlock
 * @returns {void}
 */
const iteratorBlock = b => {
  // 1. We create a chunk for this Block
  // but only once (blockChunkGroups map)
  let c = blockChunkGroups.get(b);
  if (c === undefined) {
    c = this.namedChunkGroups.get(b.chunkName);
    if (c && c.isInitial()) {
      this.errors.push(
        new AsyncDependencyToInitialChunkError(b.chunkName, module, b.loc)
      );
      c = chunkGroup;
    } else {
      // 通过 addChunkInGroup 方法创建新的 chunkGroup 及 chunk，并返回这个 chunkGroup
      c = this.addChunkInGroup(
        b.groupOptions || b.chunkName,
        module, // 这个 block 所属的 module
        b.loc,
        b.request
      );
      chunkGroupCounters.set(c, { index: 0, index2: 0 });
      blockChunkGroups.set(b, c);
      allCreatedChunkGroups.add(c);
    }
  } else {
    // TODO webpack 5 remove addOptions check
    if (c.addOptions) c.addOptions(b.groupOptions);
    c.addOrigin(module, b.loc, b.request);
  }

  // 2. We store the Block+Chunk mapping as dependency for the chunk
  let deps = chunkDependencies.get(chunkGroup);
  if (!deps) chunkDependencies.set(chunkGroup, (deps = []));
  // 当前 chunkGroup 所依赖的 block 及 chunkGroup
  deps.push({
    block: b,
    chunkGroup: c,
    couldBeFiltered: true
  });
  // 异步的 block 使用创建的新的 chunkGroup
  // 3. We enqueue the DependenciesBlock for traversal
  queueDelayed.push({
    action: PROCESS_BLOCK,
    block: b,
    module: module,
    chunk: c.chunks[0], // 获取新创建的 chunkGroup 当中的第一个 chunk，即 block 需要被加入的 chunk
    chunkGroup: c // 异步 block 使用新创建的 chunkGroup
  });
};
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

while (queue.length) { // 外层 queue 遍历
  while (queue.length) { // 内层 queue 遍历
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

### 优化 chunk graph

接下来进入到第二个步骤，遍历 chunk graph，通过和依赖的 module 之间的使用关系来建立起不同 chunkGroup 之间的父子关系，同时剔除一些没有建立起联系的 chunk。

首先还是完成一些数据的初始化工作，chunkGroupInfoMap 存放了不同 chunkGroup 相关信息：

* minAvailableModules (chunkGroup 可追踪的最小 module 数据集)
* availableModulesToBeMerged (遍历环节所使用的 module 集合)

```javascript
/** @type {Map<ChunkGroup, ChunkGroupInfo>} */
const chunkGroupInfoMap = new Map();

/** @type {Queue<ChunkGroup>} */
const queue2 = new Queue(inputChunkGroups);
for (const chunkGroup of inputChunkGroups) {
  chunkGroupInfoMap.set(chunkGroup, {
    minAvailableModules: undefined,
    availableModulesToBeMerged: [new Set()]
  });
}
```

TODO: 初始化 minAvailableModules 和 availableModulesToBeMerged 数据集

获取在第一阶段的 chunkDependencies 当中缓存的 chunkGroup 的 deps 数组依赖，chunkDependencies 中保存了不同 chunkGroup 所依赖的异步 block，以及同这个 block 一同创建的 chunkGroup（目前二者仅仅是存于一个 map 结构当中，还未建立起 chunkGroup 和 block 之间的依赖关系）。

如果 deps 数据不存在或者长度为0，那么会跳过遍历 deps 当中的 chunkGroup 流程，否则会为这个 chunkGroup 创建一个新的 available module 数据集 newAvailableModules，开始遍历这个 chunkGroup 当中所有的 chunk 所包含的 module，并加入到 newAvailableModules 这一数据集当中。并开始遍历这个 chunkGroup 的 deps 数组依赖，这个阶段主要完成的工作就是：

1. 判断 chunkGroup 提供的 newAvailableModules(可以将 newAvailableModules 理解为这个 chunkGroup 所有 module 的集合setA)和 deps 依赖中的 chunkGroup (由异步 block 创建的 chunkGroup)所包含的 chunk 当中所有的 module 集合(setB)包含关系(TODO: 具体描述)：
 * 如果在 setB 当中有 setA 没有的 module(一般是异步的 block)，它们在 chunk graph 被当做了（edge 条件）,那说明目前已经遍历过的 chunk 里面的 module 组成的 setA 还未包含所有用到的 module，而这些未被包含的 module 就存在于 deps 依赖中的 chunkGroup 当中，因此还需要继续遍历 deps 依赖中的 chunkGroup
 * 如果在 setB 当中的所有的 module 都已经存在于了 setA 当中，说明依赖的 chunkGroup 中所有使用的 module 已经包含在了目前已经遍历过的 chunk 当中了，那么就不需要进行后面的流程，直接跳过，进行下一个的依赖遍历；
2. 通过 GraphHelpers 模块提供的辅助函数`connectDependenciesBlockAndChunkGroup`建立起 deps 依赖中的异步 block 和 chunkGroup 的依赖关系；
3. 通过 GraphHelpers 模块提供的辅助函数`connectChunkGroupParentAndChild`建立起 chunkGroup 和 deps 依赖中的 chunkGroup 之间的依赖关系 **（这个依赖关系也决定了在 webpack 编译完成后输出的文件当中是否会有 deps 依赖中的 chunkGroup 所包含的 chunk）**；
4. 将 deps 依赖中的 chunkGroup 加入到 nextChunkGroups 数据集当中，接下来就进入到遍历新加入的 chunkGroup 环节。
5. 当以上所有的遍历过程都结束后，接下来开始遍历在处理异步 block 创建的 chunkGroup 组成的数据集(allCreatedChunkGroups)，开始处理没有依赖关系的 chunkGroup(chunkGroup 之间的依赖关系是在👆第3步的过程中建立起来的)，如果遇到没有任何依赖关系的 chunkGroup，那么就会将这些 chunkGroup 当中所包含的所有 chunk 从 chunk graph 依赖图当中剔除掉。最终在 webpack 编译过程结束输出文件的时候就不会生成这些 chunk。

那么在我们给出的示例当中(TODO: 示例当中这个流程的顺序图)，在上面提到的这些过程中，第一阶段处理 entryPoint(chunkGroup)，以及其包含的所有的 module，在处理过程中发现这个 entryPoint 依赖异步 block c，它包含在了 blocksWithNestedBlocks 数据集当中，因此下一阶段就是遍历异步 block c 所被包含的 chunkGroup2。


最终会生成的 chunk 依赖图为：TODO:(最终的 chunk 依赖图)


```javascript

/**
 * Helper function to check if all modules of a chunk are available
 *
 * @param {ChunkGroup} chunkGroup the chunkGroup to scan
 * @param {Set<Module>} availableModules the comparitor set
 * @returns {boolean} return true if all modules of a chunk are available
 */
// 判断chunkGroup当中是否已经包含了所有的 availableModules
const areModulesAvailable = (chunkGroup, availableModules) => {
  for (const chunk of chunkGroup.chunks) {
    for (const module of chunk.modulesIterable) {
      // 如果在 availableModules 存在没有的 module，那么返回 false
      if (!availableModules.has(module)) return false;
    }
  }
  return true;
};

// For each edge in the basic chunk graph
/**
 * @param {TODO} dep the dependency used for filtering
 * @returns {boolean} used to filter "edges" (aka Dependencies) that were pointing
 * to modules that are already available. Also filters circular dependencies in the chunks graph
 */
const filterFn = dep => {
  const depChunkGroup = dep.chunkGroup;
  if (!dep.couldBeFiltered) return true;
  if (blocksWithNestedBlocks.has(dep.block)) return true;
  if (areModulesAvailable(depChunkGroup, newAvailableModules)) {
    return false; // break, all modules are already available
  }
  dep.couldBeFiltered = false;
  return true;
};

/** @type {Map<ChunkGroup, ChunkGroupInfo>} */
const chunkGroupInfoMap = new Map();

/** @type {Queue<ChunkGroup>} */
const queue2 = new Queue(inputChunkGroups);
for (const chunkGroup of inputChunkGroups) {
  chunkGroupInfoMap.set(chunkGroup, {
    minAvailableModules: undefined,
    availableModulesToBeMerged: [new Set()]
  });
}

...

while (queue2.length) {
  chunkGroup = queue2.dequeue();
  const info = chunkGroupInfoMap.get(chunkGroup);
  const availableModulesToBeMerged = info.availableModulesToBeMerged;
  let minAvailableModules = info.minAvailableModules;

  // 1. Get minimal available modules
  // It doesn't make sense to traverse a chunk again with more available modules.
  // This step calculates the minimal available modules and skips traversal when
  // the list didn't shrink.
  availableModulesToBeMerged.sort(bySetSize);
  let changed = false;
  for (const availableModules of availableModulesToBeMerged) {
    if (minAvailableModules === undefined) {
      minAvailableModules = new Set(availableModules);
      info.minAvailableModules = minAvailableModules;
      changed = true;
    } else {
      for (const m of minAvailableModules) {
        if (!availableModules.has(m)) {
          minAvailableModules.delete(m);
          changed = true;
        }
      }
    }
  }
  availableModulesToBeMerged.length = 0;
  if (!changed) continue;

  // 获取这个 chunkGroup 的 deps 数组，包含异步的 block 及 对应的 chunkGroup
  // 2. Get the edges at this point of the graph
  const deps = chunkDependencies.get(chunkGroup);
  if (!deps) continue;
  if (deps.length === 0) continue;

  // 根据之前的 minAvailableModules 创建一个新的 newAvailableModules 数据集
  // 即之前所有遍历过的 chunk 当中的 module 都会保存到这个数据集当中，不停的累加
  // 3. Create a new Set of available modules at this points
  newAvailableModules = new Set(minAvailableModules);
  for (const chunk of chunkGroup.chunks) {
    for (const m of chunk.modulesIterable) { // 这个 chunk 当中所包含的 module
      newAvailableModules.add(m);
    }
  }

  // 边界条件，及异步的 block 所在的 chunkGroup
  // 4. Foreach remaining edge
  const nextChunkGroups = new Set();
  // 异步 block 依赖
  for (let i = 0; i < deps.length; i++) {
    const dep = deps[i];

    // Filter inline, rather than creating a new array from `.filter()`
    if (!filterFn(dep)) {
      continue;
    }
    // 这个 block 所属的 chunkGroup，在 iteratorBlock 方法内部创建的
    const depChunkGroup = dep.chunkGroup;
    const depBlock = dep.block;

    // 开始建立 block 和 chunkGroup 之间的关系
    // 在为 block 创建新的 chunk 时，仅仅建立起了 chunkGroup 和 chunk 之间的关系，
    // 5. Connect block with chunk
    GraphHelpers.connectDependenciesBlockAndChunkGroup(
      depBlock,
      depChunkGroup
    );

    // 建立起新创建的 chunkGroup 和此前的 chunkGroup 之间的相互联系
    // 6. Connect chunk with parent
    GraphHelpers.connectChunkGroupParentAndChild(chunkGroup, depChunkGroup);

    nextChunkGroups.add(depChunkGroup);
  }

  // 7. Enqueue further traversal
  for (const nextChunkGroup of nextChunkGroups) {
    ...

    // As queue deduplicates enqueued items this makes sure that a ChunkGroup
    // is not enqueued twice
    queue2.enqueue(nextChunkGroup);
  }
}

...
```