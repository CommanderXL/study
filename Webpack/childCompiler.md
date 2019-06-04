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
		if (Array.isArray(plugins)) { // 如果在子编译的过程中需要相关插件的处理，那么就在创建子编译的阶段传入这些插件
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
		childCompiler.parentCompilation = compilation;

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

通过代码我们发现在创建子编译 compiler 的过程中是过滤掉了`make`/`compiler`/`emit`/`afterEmit`等 hooks 的触发函数的，即子编译流程相对于父编译流程来说的话不具备完整的构建流程。例如在父编译的流程开始阶段会触发 hooks.make 钩子，这样完成入口文件的添加及开始相关的编译流程，而子编译要想编译文件的话就需要需要你手动的在创建子编译的时候添加入口插件。父编译阶段使用 compiler 实例上的 run 方法开始进行，而子编译阶段有一个独立的 runAsChild 方法用以开始编译，其中在 runAsChild 方法的 callback 中可以看到在子编译阶段如果需要输出文件的话，是需要挂载到父编译的 compilation.assets 上的，子编译阶段是没有单独的 emitAssets 的阶段的。

那么 childCompiler 子编译具体有哪些用途呢？在[跨平台小程序框架mpx](https://github.com/didi/mpx)当中为了将单文件当中的 wxml/wxss/json/js 这4部分的内容进行拆解并单独输出到目标文件夹。在父编译的阶段完成了各部分的代码编译并获得了编译后的代码。