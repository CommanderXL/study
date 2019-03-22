## 文件输出

当所有的 moduleId 和 chunkId 都分配完之后，调用 createChunkAssets 方法来决定最终输出到每个 chunk 当中对应的文本内容是什么。

在 createChunkAssets 方法内部会对最终需要输出的 chunk 进行遍历，根据这个 chunk 是否包含有 webpack runtime 代码来决定使用的渲染模板。那我们首先来看下包含有 webpack runtime 代码的 chunk 是如何输出最终的 chunk 文本内容的。

这种情况下使用的 mainTemplate，调用实例上的 getRenderManifest 方法获取 manifest 配置数组，其中每项包含的字段内容为:

```javascript
// hooks.manifest.tap 钩子函数

result.push({
  render: () =>
    // 这个 chunk 最终会调用这个 render 函数去完成文本的输出工作
    compilation.mainTemplate.render(
      hash,
      chunk,
      moduleTemplates.javascript,
      dependencyTemplates
    ),
  filenameTemplate,
  pathOptions: {
    noChunkHash: !useChunkHash,
    contentHashType: 'javascript',
    chunk
  },
  identifier: `chunk${chunk.id}`,
  // 使用 chunkHash 还是这次 compilation 编译的 hash 值，判断的依据为 output 当中的配置是否包含 hash
  hash: useChunkHash ? chunk.hash : fullHash
})
```

接下来会判断这个 chunk 是否有被之前已经输出过(输出过的 chunk 是会被缓存起来的)。如果没有的话，那么就会调用 render 方法去完成这个 chunk 的文本输出工作，即：`compilation.mainTemplate.render`方法。

```javascript
// MainTemplate.js

module.exports = class MainTemplate extends Tapable {
  ...
  /**
	 * @param {string} hash hash to be used for render call
	 * @param {Chunk} chunk Chunk instance
	 * @param {ModuleTemplate} moduleTemplate ModuleTemplate instance for render
	 * @param {Map<Function, DependencyTemplate>} dependencyTemplates dependency templates
	 * @returns {ConcatSource} the newly generated source from rendering
	 */
	render(hash, chunk, moduleTemplate, dependencyTemplates) { // 主要完成 webpack runtime 代码的拼接工作
		const buf = this.renderBootstrap( 
			hash,
			chunk,
			moduleTemplate,
			dependencyTemplates
		);
		let source = this.hooks.render.call(
			new OriginalSource(
				Template.prefix(buf, " \t") + "\n",
				"webpack/bootstrap"
			),
			chunk,
			hash,
			moduleTemplate,
			dependencyTemplates
		);
		if (chunk.hasEntryModule()) {
			source = this.hooks.renderWithEntry.call(source, chunk, hash);
		}
		if (!source) {
			throw new Error(
				"Compiler error: MainTemplate plugin 'render' should return something"
			);
		}
		chunk.rendered = true;
		return new ConcatSource(source, ";");
	}
  ...
}

```

在这个方法内部主要就是完成了 webpack runtime 代码的拼接工作，最终返回 ConcatSource 类型的(TODO: source 类型的描述)

TODO: 这里需要分情况说明下是否将 webpack runtime 单独抽成一个 chunk 的配置以及对应的工作流。


接下来我们看下不包含 webpack runtime 代码的 chunk 是如何输出得到最终的内容的。首先我们来了解下2个和输出 chunk 内容相关的类：

* runtimeTemplate
* moduleTemplate

其中 runtimeTemplate 类主要是提供了和模块类型相关的代码输出方法，例如你的 module 使用的是 esModule 类型，那么最终导出的代码会带有`__esModule`标识。而 moduleTemplate 类主要是对外暴露了 render 方法，内部调用对应的 module.source 用以来完成每个 module 最终代码的生成。

每个 chunk 最终代码的生成即对应 this.renderJavascript 方法：


MainTemplate
ChunkTemplate
