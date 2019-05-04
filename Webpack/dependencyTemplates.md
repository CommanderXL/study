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


我们首先来看下 handler 函数内部初始化的几个 plugin 里面注册的和 parser 编译相关的插件。

### HarmonyDetectionParserPlugin

```javascript
// HarmonyDetectionParserPlugin.js
const HarmonyCompatibilityDependency = require("./HarmonyCompatibilityDependency");
const HarmonyInitDependency = require("./HarmonyInitDependency");

module.exports = class HarmonyDetectionParserPlugin {
	apply(parser) {
		parser.hooks.program.tap("HarmonyDetectionParserPlugin", ast => {
			const isStrictHarmony = parser.state.module.type === "javascript/esm";
			const isHarmony =
				isStrictHarmony ||
				ast.body.some(statement => {
					return /^(Import|Export).*Declaration$/.test(statement.type);
				});
			if (isHarmony) {
				// 获取当前的正在编译的 module
				const module = parser.state.module;
				const compatDep = new HarmonyCompatibilityDependency(module);
				compatDep.loc = {
					start: {
						line: -1,
						column: 0
					},
					end: {
						line: -1,
						column: 0
					},
					index: -3
				};
				// 给这个 module 添加一个 compatDep 依赖
				module.addDependency(compatDep);
				const initDep = new HarmonyInitDependency(module);
				initDep.loc = {
					start: {
						line: -1,
						column: 0
					},
					end: {
						line: -1,
						column: 0
					},
					index: -2
				};
				// 给这个 module 添加一个 initDep 依赖
				module.addDependency(initDep);
				parser.state.harmonyParserScope = parser.state.harmonyParserScope || {};
				parser.scope.isStrict = true;
				// 初始化这个 module 最终被编译生成的 meta 元信息，
				module.buildMeta.exportsType = "namespace";
				module.buildInfo.strict = true;
				module.buildInfo.exportsArgument = "__webpack_exports__";
				if (isStrictHarmony) {
					module.buildMeta.strictHarmonyModule = true;
					module.buildInfo.moduleArgument = "__webpack_module__";
				}
			}
		});

    ...
	}
};
```

在每个 module 开始编译的时候便会触发这个 plugin 上注册的 hooks。通过 AST 的节点类型来判断这个 module 是否是 ES Module，如果是的话，首先会实例化一个`HarmonyCompatibilityDependency`依赖的实例，并记录依赖需要替换的位置，然后将这个实例加入到 module 的依赖中，接下来实例化一个`HarmonyInitDependency`依赖的实例，并记录依赖需要替换的位置，然后将实例加入到 module 的依赖当中。然后会设定当前被 parser 处理的 module 最终被渲染时的一些构建信息，例如`exportsArgument`可能会使用`__webpack_exports__`，即这个模块输出挂载变量使用`__webpack_exports__`。

其中`HarmonyCompatibilityDependency`依赖的 Template 主要是：

```javascript
HarmonyCompatibilityDependency.Template = class HarmonyExportDependencyTemplate {
	apply(dep, source, runtime) {
		const usedExports = dep.originModule.usedExports;
		if (usedExports !== false && !Array.isArray(usedExports)) {
			// 定义 module 的 export 类型
			const content = runtime.defineEsModuleFlagStatement({
				exportsArgument: dep.originModule.exportsArgument
			});
			source.insert(-10, content);
		}
	}
}
```

调用 RuntimeTemplate 实例上提供的 defineEsModuleFlagStatement 方法在当前模块最终生成的代码内插入代码:

```javascript
__webpack_require__.r(__webpack_exports__) // 用以在 __webpack_exports__ 上定义一个 __esModule 属性，用以标识当前 module 是一个 ES Module
```

而在`HarmonyInitDependency`依赖的 Template 中主要完成的工作是：

```javascript
HarmonyInitDependency.Template = class HarmonyInitDependencyTemplate {
	apply(dep, source, runtime, dependencyTemplates) {
		const module = dep.originModule;
		const list = [];
    // 遍历这个依赖的所属的 module 的所有依赖
		for (const dependency of module.dependencies) {
      // 获取不同依赖所使用的 template
			const template = dependencyTemplates.get(dependency.constructor);
      // 部分 template 并不是在 generator 调用 generate 方法立即执行相关模板依赖的替换工作的
      // 而是将相关的操作置于 harmonyInit 函数当中，在这个会被加入到一个数组当中
			if (
				template &&
				typeof template.harmonyInit === "function" &&
				typeof template.getHarmonyInitOrder === "function"
			) {
				const order = template.getHarmonyInitOrder(dependency);
				if (!isNaN(order)) {
					list.push({
						order,
						listOrder: list.length,
						dependency,
						template
					});
				}
			}
		}

    // 对模板依赖数组进行排序
		list.sort((a, b) => {
			const x = a.order - b.order;
			if (x) return x;
			return a.listOrder - b.listOrder;
		});

    // 依次执行模板依赖上的 harmonyInit 方法，这个时候开始相关模板的替换工作
		for (const item of list) {
			item.template.harmonyInit(
				item.dependency,
				source,
				runtime,
				dependencyTemplates
			);
		}
	}
}
```
### HarmonyImportDependencyParserPlugin

接下来我们再来看 HarmonyModulesPlugin 插件里面初始化的第二个插件`HarmonyImportDependencyParserPlugin`，这个插件主要完成的工作是和 ES Module 当中使用 import 语法相关：

```javascript
module.exports = class HarmonyImportDependencyParserPlugin {
  constructor() {
    ...
  }

  apply(parser) {
    ...
    parser.hooks.import.tap('HarmonyImportDependencyParserPlugin', (statement, source) => {
      ...
      const sideEffectDep = new HarmonyImportSideEffectDependency({ ... })

      parser.state.module.addDependency(sideEffectDep);
      ...
    })

    parser.hooks.importSpecifier.tap('HarmonyImportDependencyParserPlugin', (statement, source, id, name) => {
      ...
      // 设置引入模块名的映射关系
      parser.state.harmonySpecifier.set(name, {
        source,
        id,
        sourceOrder: parser.state.lastHarmonyImportOrder
      });
      ...
    })

    parser.hooks.expression
      .for('imported var')
      .tap('HarmonyImportDependencyParserPlugin', expr => {
        ...
				const dep = new HarmonyImportSpecifierDependency({ ... });

        parser.state.module.addDependency(dep);
        ...
      })

    parser.hooks.call
      .for('imported var')
      .tap('HarmonyImportDependencyParserPlugin', expr => {
        ...
        const dep = new HarmonyImportSpecifierDependency({ ... })

        parser.state.module.addDependency(dep);
        ...
      })
  }
}
```

在这个插件里面主要是注册了在模块通过 parser 编译的过程中，遇到不同 tokens 触发的 hooks。例如`hooks.importSpecifier`主要是用于你通过`import`语法加载其他模块时所申明的变量名，会通过一个 map 结构记录这个变量名。当你在源代码中使用了这个变量名，例如作为一个函数去调用（对应触发`hooks.call`钩子），或者是作为一个表达式去访问（对应触发`hooks.express`钩子），那么它们都会新建一个`HarmonyImportSpecifierDependency`依赖的实例，并进入到当前被编译的 module 当中。

这个`HarmonyImportSpecifierDependency`模板依赖主要完成的工作就是：

```javascript
HarmonyImportSpecifierDependency.Template = class HarmonyImportSpecifierDependencyTemplate extends HarmonyImportDependency.Template {
	apply(dep, source, runtime) {
		super.apply(dep, source, runtime);
		const content = this.getContent(dep, runtime);
		source.replace(dep.range[0], dep.range[1] - 1, content);
	}

	getContent(dep, runtime) {
		const exportExpr = runtime.exportFromImport({
			module: dep._module,
			request: dep.request,
			exportName: dep._id,
			originModule: dep.originModule,
			asiSafe: dep.shorthand,
			isCall: dep.call,
			callContext: !dep.directImport,
			importVar: dep.getImportVar()
		});
		return dep.shorthand ? `${dep.name}: ${exportExpr}` : exportExpr;
	}
};
```
将源码中引入的其他模块的依赖变量名进行字符串的替换，具体可以查阅`RuntimeTemplate.exportFromImport`方法。

我们来看个例子：

```javascript
// 在 parse 编译过程中，触发 hooks.importSpecifier 钩子，通过 map 记录对应变量名
import { add } from './add.js'

// 触发 hooks.call 钩子，给 module 加入 HarmonyImportSpecifierDependency 依赖
add(1, 2)

--- 

// 最终生成的代码为：
/* harmony import */ var _add__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);

Object(_b__WEBPACK_IMPORTED_MODULE_0__["add"])(1, 2);
```

### HarmonyExportDependencyParserPlugin 

这个插件主要完成的是和 ES Module 当中使用 export 语法相关的工作：

```javascript
module.exports = class HarmonyExportDependencyParserPlugin {
	constructor(moduleOptions) {
		this.strictExportPresence = moduleOptions.strictExportPresence;
	}

	apply(parser) {
		parser.hooks.export.tap(
			"HarmonyExportDependencyParserPlugin",
			statement => {
        ...
				const dep = new HarmonyExportHeaderDependency(...);
				...
				parser.state.current.addDependency(dep);
				return true;
			}
		);
		parser.hooks.exportImport.tap(
			"HarmonyExportDependencyParserPlugin",
			(statement, source) => {
        ...
				const sideEffectDep = new HarmonyImportSideEffectDependency(...);
				...
				parser.state.current.addDependency(sideEffectDep);
				return true;
			}
		);
		parser.hooks.exportExpression.tap(
			"HarmonyExportDependencyParserPlugin",
			(statement, expr) => {
        ...
				const dep = new HarmonyExportExpressionDependency(...);
        ...
				parser.state.current.addDependency(dep);
				return true;
			}
		);
		parser.hooks.exportDeclaration.tap(
			"HarmonyExportDependencyParserPlugin",
			statement => {}
		);
		parser.hooks.exportSpecifier.tap(
			"HarmonyExportDependencyParserPlugin",
			(statement, id, name, idx) => {
        ...
				if (rename === "imported var") {
					const settings = parser.state.harmonySpecifier.get(id);
					dep = new HarmonyExportImportedSpecifierDependency(...);
				} else {
					dep = new HarmonyExportSpecifierDependency(...);
				}
				parser.state.current.addDependency(dep);
				return true;
			}
		);
		parser.hooks.exportImportSpecifier.tap(
			"HarmonyExportDependencyParserPlugin",
			(statement, source, id, name, idx) => {
				...
				const dep = new HarmonyExportImportedSpecifierDependency(...);
				...
				parser.state.current.addDependency(dep);
				return true;
			}
		);
	}
};
```

parse 在编译源码过程中，根据你使用的不同的 ES Module export 语法去触发不通过的 hooks，然后给当前编译的 module 加入对应的依赖 module。还是通过2个例子来看：

```javascript
// export 一个 add 标识符，在 parse 环节会触发 hooks.exportSpecifier 钩子，会在当前 module 加入一个 HarmonyExportSpecifierDependency 依赖
export function add() {} 

---

// 最终在输出文件当中输出的内容为
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "add", function() { return add; });

function add() {}
```

```javascript
// export 从 add.js 模块加载的 add 标识符，在 parse 环节会触发 hooks.exportImportSpecifier 钩子，会在当前 module 加入一个 HarmonyExportImportedSpecifierDependency 依赖
export { add } from './add'

---

// 最终在输出文件当中输出的内容为
/* harmony import */ var _add__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "add", function() { return _add__WEBPACK_IMPORTED_MODULE_0__["add"]; });
```

具体替换的工作可以查阅`HarmonyExportSpecifierDependency.Template`和`HarmonyExportImportedSpecifierDependency.Template`提供的依赖模板函数。