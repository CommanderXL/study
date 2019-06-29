## childCompiler 子编译

webpack 子编译可以理解成创建了一个新的构建流程。webpack 内部的 compilation 的实例上提供了创建子编译流程的 API：createChildCompiler。

```javascript
class Compilation {
  ...
  /**
	 * This function allows you to run another instance of webpack inside of webpack however as
	 * a child with different settings and configurations (if desired) applied. It copies all hooks, plugins
	 * from parent (or top level compiler) and creates a child Compilation
	 *
	 * @param {string} name name of the child compiler
	 * @param {TODO} outputOptions // Need to convert config schema to types for this
	 * @param {Plugin[]} plugins webpack plugins that will be applied
	 * @returns {Compiler} creates a child Compiler instance
	 */
  createChildCompiler(name, outputOptions, plugins) {
    const idx = this.childrenCounters[name] || 0;
    this.childrenCounters[name] = idx + 1;
    return this.compiler.createChildCompiler(
      this, // 传入 compilation 对象
      name,
      idx,
      outputOptions,
      plugins
    );
  }
  ...
}
```

那么这个子编译流程到底和父编译流程有哪些差异呢？

```javascript
class Compiler {
  ...
  createChildCompiler(
		compilation,
		compilerName,
		compilerIndex,
		outputOptions,
		plugins
	) {
		const childCompiler = new Compiler(this.context); // 创建新的 compiler 对象，和父 compiler 拥有相同的 context 上下文路径
		if (Array.isArray(plugins)) { // 如果在子编译的过程中需要相关插件的处理，那么就在创建子编译的阶段传入这些插件，需要注意的是在这个阶段执行这些插件的话，下面的有关 childCompiler 一些配置信息是拿不到的，因此可以先创建 childCompiler，然后由自己去手动的 apply 插件
			for (const plugin of plugins) {
				plugin.apply(childCompiler);
			}
		}
		for (const name in this.hooks) {
			if (
				![
					"make",
					"compile",
					"emit",
					"afterEmit",
					"invalid",
					"done",
					"thisCompilation"
				].includes(name) 
			) {
				if (childCompiler.hooks[name]) { // 子编译不会继承上面列出来的编译流程当中的钩子
					childCompiler.hooks[name].taps = this.hooks[name].taps.slice();
				}
			}
		}
    // 接下来就是设置子编译 compiler 实例上的相关的属性或者方法
		childCompiler.name = compilerName;
		childCompiler.outputPath = this.outputPath;
		childCompiler.inputFileSystem = this.inputFileSystem;
		childCompiler.outputFileSystem = null;
		childCompiler.resolverFactory = this.resolverFactory;
		childCompiler.fileTimestamps = this.fileTimestamps;
		childCompiler.contextTimestamps = this.contextTimestamps;

		const relativeCompilerName = makePathsRelative(this.context, compilerName);
		if (!this.records[relativeCompilerName]) {
			this.records[relativeCompilerName] = [];
		}
		if (this.records[relativeCompilerName][compilerIndex]) {
			childCompiler.records = this.records[relativeCompilerName][compilerIndex];
		} else {
			this.records[relativeCompilerName].push((childCompiler.records = {}));
		}

		childCompiler.options = Object.create(this.options); // options 配置继承于父编译 compiler 实例
		childCompiler.options.output = Object.create(childCompiler.options.output);
		for (const name in outputOptions) {
			childCompiler.options.output[name] = outputOptions[name];
		}
		childCompiler.parentCompilation = compilation; // 建立父子编译之间的关系

    // 触发 childCompiler hooks
		compilation.hooks.childCompiler.call(
			childCompiler,
			compilerName,
			compilerIndex
		);

		return childCompiler;
	}
  ...
}
```

通过代码我们发现在创建子编译 compiler 的过程中是过滤掉了`make`/`compiler`/`emit`/`afterEmit`等 hooks 的触发函数的，即子编译流程相对于父编译流程来说的话不具备完整的构建流程。例如在父编译的流程开始阶段会触发 hooks.make 钩子，这样完成入口文件的添加及开始相关的编译流程，而子编译要想完成编译文件的工作的话就需要你手动的在创建子编译的时候添加入口插件（例如 SingleEntryPlugin）。父编译阶段使用 compiler 实例上的 run 方法开始进行，而子编译阶段有一个独立的 runAsChild 方法用以开始编译，其中在 runAsChild 方法的 callback 中可以看到子编译阶段是没有单独的 emitAssets 的阶段的。在子编译阶段如果需要输出文件的话，是需要挂载到父编译的 compilation.assets 上的:

```javascript
class Compiler {
	...
	runAsChild() {
		this.compile((err, compilation) => {
			...
			this.parentCompilation.children.push(compilation)
			for (const name of Object.keys(compilation.assets)) { // 将子编译需要输出的 chunk 文件挂载到父编译上，进而完成相关的 chunk 的输出工作
				this.parentCompilation.assets[name] = compilation.assets[name];
			}
			...
		})
	}
	...
}
```

那么 childCompiler 子编译具体有哪些使用场景呢？在 webpack 官方的抽离 css chunk 的插件当中[mini-css-extract-plugin](https://github.com/webpack-contrib/mini-css-extract-plugin)就是使用到了 childCompiler 子编译去完成 css 的抽离工作，它主要体现了这个插件内部会提供了一个单独的 pitch loader，使用这个 pitch loader 进行样式模块(例如css/stylus/scss/less)的流程处理的拦截工作，在拦截的过程当中**为每个样式模块都创建新的 childCompiler**，这个 childCompiler 主要完成的工作就是专门针对这个样式模块进行编译相关的工作。可以想象的到就是每一个样式模块完成编译的工作后，都会生成一个 css chunk file。当然我们最终希望的是这些 css chunk file 最终能合并到一个 css chunk 文件当中，最后项目上线后，只需要加载少量的 css 文件。因此在 mini-css-extract-plugin 插件内部，每个样式模块通过子编译的流程后，是直接删除掉了 compilation.chunks 当中包含的所有的 file，即这些 css 模块最终不会被挂载到父编译的 assets 上，这样也不会为每个样式模块输出一个 css chunk file。这个插件等每个样式模块的子编译流程结束后，都会新建一个 css module，这个 css module 依赖类型为插件内部自己定义的，并且会作为当前正在编译的 module 依赖而被添加到当前模块当中。接下来，在父编译的 createChunkAssets 流程当中，分别触发 maniTemplate.hooks.renderManifest 和 chunkTemplate.hooks.renderManifest 的钩子的时候，会分别将 chunk 当中所包含的 css module 过滤出来，得到 css module 的集合，这样最终在输出文件的时候就会输出 css chunk 文件，这些 css chunk 文件当中就是分别包含了 css module 的集合而输出的。

PS：不过在你写插件或者 loader 的过程中，需要注意的一个地方就是一些 hooks，例如 thisCompilation 是不会被 childCompiler 继承的，因此有些插件注册的相关的 hooks 正好是这个，那么在你创建了 childCompiler 需要手动的调用插件的 apply 方法并传入 childCompiler，这样这些插件才能在 childCompiler 当中工作起来。