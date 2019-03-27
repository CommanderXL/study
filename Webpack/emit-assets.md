## 文件输出

当所有的 moduleId 和 chunkId 都分配完之后，调用 createChunkAssets 方法来决定最终输出到每个 chunk 当中对应的文本内容是什么。

在 createChunkAssets 方法内部会对最终需要输出的 chunk 进行遍历，根据这个 chunk 是否包含有 webpack runtime 代码来决定使用的渲染模板。那我们首先来看下包含有 webpack runtime 代码的 chunk 是如何输出最终的 chunk 文本内容的。

这种情况下使用的 mainTemplate，调用实例上的 getRenderManifest 方法获取 manifest 配置数组，其中每项包含的字段内容为:

// TODO: 简单的介绍下 JavascriptModulesPlugin 插件的用途

```javascript
// hooks.manifest.tap 钩子函数

compilation.mainTemplate.hooks.renderManifest.tap('JavascriptModulesPlugin', () => {
	...
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
	...
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

接下来我们看下不包含 webpack runtime 代码的 chunk (使用 chunkTemplate 渲染模板)是如何输出得到最终的内容的。首先我们来了解下 2 个和输出 chunk 内容相关的类：

- RuntimeTemplate
- ModuleTemplate

其中 RuntimeTemplate 类主要是提供了和模块类型相关的代码输出方法，例如你的 module 使用的是 esModule 类型，那么导出的代码模块会带有`__esModule`标识，而通过 import 语法引入的外部模块都会通过`/* harmony import */`注释来进行标识。
而 ModuleTemplate 类主要是对外暴露了 render 方法，在这个方法内部会调用对应的 module.source 用以来完成每个 module 最终代码的生成。

chunkTemplate 同样调用 getRenderManifest 方法来获取对应的 manifest 配置数组：

```javascript
// JavascriptModulesPlugin.js

class JavascriptModulesPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap('JavascriptModulesPlugin', (compilation, { normalModuleFactory }) => {
			...
			// chunkTemplate hooks.manifest 钩子函数
			compilation.chunkTemplate.hooks.renderManifest.tap('JavascriptModulesPlugin', (result, options) => {
				...
				result.push({
					render: () =>
						// 每个 chunk 代码的生成即调用 JavascriptModulesPlugin 提供的 renderJavascript 方法来进行生成
						this.renderJavascript(
							compilation.chunkTemplate, // chunk模板
							chunk, // 需要生成的 chunk 实例
							moduleTemplates.javascript, // 模块类型
							dependencyTemplates // 不同依赖所对应的渲染模板
						),
					filenameTemplate,
					pathOptions: {
						chunk,
						contentHashType: 'javascript'
					},
					identifier: `chunk${chunk.id}`,
					hash: chunk.hash
				})
				...
			})
			...
		})
	}

	renderJavascript(chunkTemplate, chunk, moduleTemplate, dependencyTemplates) {
		const moduleSources = Template.renderChunkModules(
			chunk,
			m => typeof m.source === "function",
			moduleTemplate,
			dependencyTemplates
		)
		const core = chunkTemplate.hooks.modules.call(
			moduleSources,
			chunk,
			moduleTemplate,
			dependencyTemplates
		)
		let source = chunkTemplate.hooks.render.call(
			core,
			chunk,
			moduleTemplate,
			dependencyTemplates
		)
		if (chunk.hasEntryModule()) {
			source = chunkTemplate.hooks.renderWithEntry.call(source, chunk)
		}
		chunk.rendered = true
		return new ConcatSource(source, ";")
	}
}

```

接下来便调用 JavascriptModulesPlugin 这个插件提供的 renderJavascript 方法开始生成每个 chunk 所依赖的 module 的最终代码，首先进入 Template 这个基类提供的`Template.renderChunkModules`方法：

```javascript
class Template {
	...
	/**
	 * @param {WithId[]} modules a collection of modules to get array bounds for
	 * @returns {[number, number] | false} returns the upper and lower array bounds
	 * or false if not every module has a number based id
	 */
	static getModulesArrayBounds(modules) {
		let maxId = -Infinity;
		let minId = Infinity;
		for (const module of modules) {
			if (typeof module.id !== "number") return false;
			if (maxId < module.id) maxId = /** @type {number} */ (module.id);
			if (minId > module.id) minId = /** @type {number} */ (module.id);
		}
		if (minId < 16 + ("" + minId).length) {
			// add minId x ',' instead of 'Array(minId).concat(…)'
			minId = 0;
		}
		const objectOverhead = modules
			.map(module => (module.id + "").length + 2)
			.reduce((a, b) => a + b, -1);
		const arrayOverhead =
			minId === 0 ? maxId : 16 + ("" + minId).length + maxId;
		return arrayOverhead < objectOverhead ? [minId, maxId] : false;
	}

	/**
	 * @param {Chunk} chunk chunk whose modules will be rendered
	 * @param {ModuleFilterPredicate} filterFn function used to filter modules from chunk to render
	 * @param {ModuleTemplate} moduleTemplate ModuleTemplate instance used to render modules
	 * @param {TODO | TODO[]} dependencyTemplates templates needed for each module to render dependencies
	 * @param {string=} prefix applying prefix strings
	 * @returns {ConcatSource} rendered chunk modules in a Source object
	 */
	static renderChunkModules(
		chunk,
		filterFn,
		moduleTemplate,
		dependencyTemplates,
		prefix = ""
	) {
		const source = new ConcatSource();
		const modules = chunk.getModules().filter(filterFn); // 通过过滤函数获取满足条件的 module
		let removedModules;
		if (chunk instanceof HotUpdateChunk) {
			removedModules = chunk.removedModules;
		}
		if (
			modules.length === 0 &&
			(!removedModules || removedModules.length === 0)
		) {
			source.add("[]");
			return source;
		}
		// 遍历这个 chunk 所需要渲染的 module，调用 moduleTemplate 模板提供的 render 去渲染 module 最终代码
		/** @type {{id: string|number, source: Source|string}[]} */
		const allModules = modules.map(module => {
			return {
				id: module.id,
				source: moduleTemplate.render(module, dependencyTemplates, { // 渲染每个 module
					chunk
				})
			};
		});
		if (removedModules && removedModules.length > 0) {
			for (const id of removedModules) {
				allModules.push({
					id,
					source: "false"
				});
			}
		}
		// 获取这个 chunk 当中所包含的所有的 module 的 id 边界，如果是有限的 id 边界，那么会返回一个数组: [minId, maxId]
		// 如果是没有边界的，那么最终会通过对象的形式出现在 chunk 当中
		const bounds = Template.getModulesArrayBounds(allModules);
		if (bounds) {
			// Render a spare array
			const minId = bounds[0];
			const maxId = bounds[1];
			console.log('minId and maxId:', minId, maxId)
			if (minId !== 0) {
				source.add(`Array(${minId}).concat(`);
			}
			source.add("[\n");
			/** @type {Map<string|number, {id: string|number, source: Source|string}>} */
			const modules = new Map();
			for (const module of allModules) {
				modules.set(module.id, module);
			}
			for (let idx = minId; idx <= maxId; idx++) {
				const module = modules.get(idx);
				if (idx !== minId) {
					source.add(",\n");
				}
				source.add(`/* ${idx} */`);
				if (module) {
					// console.log('module.source: ', module.source)
					source.add("\n");
					source.add(module.source); // 添加每个 module 最终输出的代码
				}
			}
			source.add("\n" + prefix + "]");
			if (minId !== 0) {
				source.add(")");
			}
		} else {
			// Render an object
			source.add("{\n");
			allModules.sort(stringifyIdSortPredicate).forEach((module, idx) => {
				if (idx !== 0) {
					source.add(",\n");
				}
				source.add(`\n/***/ ${JSON.stringify(module.id)}:\n`);
				source.add(module.source);
			});
			source.add(`\n\n${prefix}}`);
		}
		return source;
	}
	...
}
```

在 renderChunkModules 方法内部，首先通过 filerFn 来获取所有需要被渲染的 module，接下来依次遍历这些 module，在遍历的过程中调用 moduleTemplate 模板上的 render 完成每个 module 的渲染工作(后文会单独讲)，我们都知道在 seal 阶段，会调用 applyModuleIds 方法完成所有的 module 的 id 分配工作，最终每个 module 都有一个唯一标识 id。在 Template 类上提供了静态方法 getModulesArrayBounds 用以获取当前需要被渲染 chunk 当中所包含的 module 的 id 范围大小，而这个范围大小决定了 module 在 chunk 是以数组的形式还是 key(module id)/value(Fn) 键值对的形式被渲染出来。

通过 import 等异步API加载的 module，会被单独分配到一个 chunk 当中，这个 chunk 当中只包含这一个异步的 module，调用`Template.getModulesArrayBounds`方法后，获取的值为false，最终这个 chunk 被渲染出来所包含的 module 是 key/value 的形式：

```javascript
(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[2],{
	5(module id): module.source(Fn)
}])
```

TODO: 普通的 chunk 最终渲染出来的形式

刚才上文中提到了在遍历 module 的过程中调用`moduleTemplate.render`方法完成了 module 的渲染工作:

```javascript
class ModuleTemplate extends Tabable {
	...
	/**
	 * @param {Module} module the module
	 * @param {TODO} dependencyTemplates templates for dependencies
	 * @param {TODO} options render options
	 * @returns {Source} the source
	 */
	 render(module, dependencyTemplates, options) {
			const moduleSource = module.source(
				dependencyTemplates,
				this.runtimeTemplate,
				this.type
			);

			const moduleSourcePostContent = this.hooks.content.call(...)
			const moduleSourcePostModule = this.hooks.module.call(...)
			const moduleSourcePostRender = this.hooks.render.call(...)
			return this.hooks.package.call(...)
	 }
}
```

在接下去讲之前，回忆下通过 NormalModuleFactory 创建 NormalModule 过程中会调用 createGenerator 方法获取最终渲染这个 module 所需要的 generator 生成器。

```javascript
class NormalModuleFactory extends Tapable {
	...
	createGenerator(type, generatorOptions = {}) {
		// 通过 NormalModuleFactory 暴露出去的 createGenerator 钩子来获取对应的 generator 生成器
		const generator = this.hooks.createGenerator
			.for(type)
			.call(generatorOptions);
		if (!generator) {
			throw new Error(`No generator registered for ${type}`);
		}
		this.hooks.generator.for(type).call(generator, generatorOptions);
		return generator;
	}
	...
}
```

每个 NormalModule 实例上都有 source 方法，其内部调用在 module 创建初期获取的 generator 生成器的 generate 方法去生成 module 代码，这才进入到生成 module 代码最核心的步骤：

```javascript
class JavascriptGenerator {
	generate(module, dependencyTemplates, runtimeTemplate) {
		const originalSource = module.originalSource(); // 获取这个 module 的 originSource
		if (!originalSource) {
			return new RawSource("throw new Error('No source available');");
		}

		const source = new ReplaceSource(originalSource);

		this.sourceBlock(
			module,
			module,
			[],
			dependencyTemplates,
			source,
			runtimeTemplate
		);

		return source;
	}

	sourceBlock(
		module,
		block,
		availableVars,
		dependencyTemplates,
		source,
		runtimeTemplate
	) {
		// 处理这个 module 的 dependency 的渲染模板内容
		for (const dependency of block.dependencies) {
			this.sourceDependency(
				dependency,
				dependencyTemplates,
				source,
				runtimeTemplate
			);
		}

		...

		for (const childBlock of block.blocks) {
			this.sourceBlock(
				module,
				childBlock,
				availableVars.concat(vars),
				dependencyTemplates,
				source,
				runtimeTemplate
			);
		}
	}

	// 获取对应的 template 方法并执行，完成依赖的渲染工作
	sourceDependency(dependency, dependencyTemplates, source, runtimeTemplate) {
		const template = dependencyTemplates.get(dependency.constructor);
		if (!template) {
			throw new Error(
				"No template for dependency: " + dependency.constructor.name
			);
		}
		template.apply(dependency, source, runtimeTemplate, dependencyTemplates);
	}
}
```

这里我们来看几个依赖是如何渲染得到最终输入的内容的。


MainTemplate
ChunkTemplate
