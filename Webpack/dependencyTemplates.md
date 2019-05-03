## dependencyTemplates 依赖模板

webpack 对于不同依赖模块的模板处理都有单独的依赖模块类型文件来进行处理。例如，在你写的源代码当中，使用的是ES Module，那么最终会由 HarmonyModulesPlugin 里面使用的依赖进行处理，再例如你写的源码中模块使用的是符合 CommonJS Module 规范，那么最终会有 CommonJsPlugin 里面使用的依赖进行处理。除此外，webpack 还对于其他类型的模块依赖语法也做了处理：

* AMD -> AMDPlugin
* System -> SystemPlugin
* Require.ensure -> RequireEnsurePlugin
* Import (分包异步加载 module) -> ImportPlugin
* ...

```javascript
// WebpackOptionsApply.js

const LoaderPlugin = require("./dependencies/LoaderPlugin");
const CommonJsPlugin = require("./dependencies/CommonJsPlugin");
const HarmonyModulesPlugin = require("./dependencies/HarmonyModulesPlugin");
const SystemPlugin = require("./dependencies/SystemPlugin");
const ImportPlugin = require("./dependencies/ImportPlugin");
const AMDPlugin = require("./dependencies/AMDPlugin");
const RequireContextPlugin = require("./dependencies/RequireContextPlugin");
const RequireEnsurePlugin = require("./dependencies/RequireEnsurePlugin");
const RequireIncludePlugin = require("./dependencies/RequireIncludePlugin");

class WebpackOptionsApply extends OptionsApply {
  constructor() {
    super()
  }

  process(options, compiler) {
    ...
    new HarmonyModulesPlugin(options.module).apply(compiler);
		new AMDPlugin(options.module, options.amd || {}).apply(compiler);
		new CommonJsPlugin(options.module).apply(compiler);
		new LoaderPlugin().apply(compiler);

    new RequireIncludePlugin().apply(compiler);
		new RequireEnsurePlugin().apply(compiler);
		new RequireContextPlugin(
			options.resolve.modules,
			options.resolve.extensions,
			options.resolve.mainFiles
		).apply(compiler);
		new ImportPlugin(options.module).apply(compiler);
		new SystemPlugin(options.module).apply(compiler);
    ...
  }
}
```


模块依赖语法的处理对于 webpack 生成最终的文件内容非常的重要。这些针对不同依赖加载语法的处理插件在 webpack 初始化创建 compiler 的时候就完成了加载及初始化过程。这里我们可以来看下模块遵循 ES Module 所使用的相关的依赖依赖模板的处理是如何进行的，即 HarmonyModulesPlugin 这个插件内部主要完成的工作。


```javascript
// part 1: 引入的主要是 ES Module 当中使用的不同语法的依赖类型
const HarmonyCompatibilityDependency = require("./HarmonyCompatibilityDependency");
const HarmonyInitDependency = require("./HarmonyInitDependency");
const HarmonyImportSpecifierDependency = require("./HarmonyImportSpecifierDependency");
const HarmonyImportSideEffectDependency = require("./HarmonyImportSideEffectDependency");
const HarmonyExportHeaderDependency = require("./HarmonyExportHeaderDependency");
const HarmonyExportExpressionDependency = require("./HarmonyExportExpressionDependency");
const HarmonyExportSpecifierDependency = require("./HarmonyExportSpecifierDependency");
const HarmonyExportImportedSpecifierDependency = require("./HarmonyExportImportedSpecifierDependency");
const HarmonyAcceptDependency = require("./HarmonyAcceptDependency");
const HarmonyAcceptImportDependency = require("./HarmonyAcceptImportDependency");

const NullFactory = require("../NullFactory");

// part 2: 引入的主要是 ES Module 使用的不同的语法，在编译过程中需要挂载的 hooks，方便做依赖收集
const HarmonyDetectionParserPlugin = require("./HarmonyDetectionParserPlugin");
const HarmonyImportDependencyParserPlugin = require("./HarmonyImportDependencyParserPlugin");
const HarmonyExportDependencyParserPlugin = require("./HarmonyExportDependencyParserPlugin");
const HarmonyTopLevelThisParserPlugin = require("./HarmonyTopLevelThisParserPlugin");

class HarmonyModulesPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"HarmonyModulesPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					HarmonyCompatibilityDependency,
					new NullFactory()
				);
				// 设置对应的依赖渲染所需要的模板
				compilation.dependencyTemplates.set(
					HarmonyCompatibilityDependency,
					new HarmonyCompatibilityDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyInitDependency,
					new NullFactory()
				);
				compilation.dependencyTemplates.set(
					HarmonyInitDependency,
					new HarmonyInitDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyImportSideEffectDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					HarmonyImportSideEffectDependency,
					new HarmonyImportSideEffectDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyImportSpecifierDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					HarmonyImportSpecifierDependency,
					new HarmonyImportSpecifierDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyExportHeaderDependency,
					new NullFactory()
				);
				compilation.dependencyTemplates.set(
					HarmonyExportHeaderDependency,
					new HarmonyExportHeaderDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyExportExpressionDependency,
					new NullFactory()
				);
				compilation.dependencyTemplates.set(
					HarmonyExportExpressionDependency,
					new HarmonyExportExpressionDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyExportSpecifierDependency,
					new NullFactory()
				);
				compilation.dependencyTemplates.set(
					HarmonyExportSpecifierDependency,
					new HarmonyExportSpecifierDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyExportImportedSpecifierDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					HarmonyExportImportedSpecifierDependency,
					new HarmonyExportImportedSpecifierDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyAcceptDependency,
					new NullFactory()
				);
				compilation.dependencyTemplates.set(
					HarmonyAcceptDependency,
					new HarmonyAcceptDependency.Template()
				);

				compilation.dependencyFactories.set(
					HarmonyAcceptImportDependency,
					normalModuleFactory
				);
				compilation.dependencyTemplates.set(
					HarmonyAcceptImportDependency,
					new HarmonyAcceptImportDependency.Template()
				);

				const handler = (parser, parserOptions) => {
					if (parserOptions.harmony !== undefined && !parserOptions.harmony)
						return;

					new HarmonyDetectionParserPlugin().apply(parser);
					new HarmonyImportDependencyParserPlugin(this.options).apply(parser);
					new HarmonyExportDependencyParserPlugin(this.options).apply(parser);
					new HarmonyTopLevelThisParserPlugin().apply(parser);
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("HarmonyModulesPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/esm")
					.tap("HarmonyModulesPlugin", handler);
			}
		);
	}
}
module.exports = HarmonyModulesPlugin;
```

在 HarmonyModulesPlugin 引入的文件当中主要是分为了2部分：

* ES Module 当中使用的不同语法的依赖类型
* ES Module 使用的不同的依赖语法，在代码通过 parser 编译过程中需要挂载的 hooks(这些 hooks 都是通过相关 plugin 进行注册)，方便做依赖收集

当 webpack 创建新的 compilation 对象后，便执行`compiler.hooks.compilation`注册的钩子内部的方法。其中主要完成了以下几项工作：

1.设置不同依赖类型的 moduleFactory，例如设置`HarmonyImportSpecifierDependency`依赖类型的 moduleFactory 为`normalModuleFactory`；
2.设置不同依赖类型的 dependencyTemplate，例如设置`HarmonyImportSpecifierDependency`依赖类型的模板为`new HarmonyImportSpecifierDependency.Template()`实例；
3.注册 normalModuleFactory.hooks.parser 钩子函数，每当新建一个 normalModule 时这个钩子函数都会被执行，即触发 handler 函数的执行。handler 函数内部去初始化各种 plugin，注册相关的 hooks。




