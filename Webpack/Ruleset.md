## Ruleset loader过滤器

Ruleset 类主要作用于过滤加载 module 时符合匹配条件规则的 loader。Ruleset 在内部会有一个默认的 module.defaultRules 配置，在真正加载 module 之前会和你在 webpack config 配置文件当中的自定义 module.rules 进行合并，然后转化成对应的匹配过滤器。

webpack 文档上对于 Ruleset 的说明太过于抽象，在文档上提到的条件，结果和嵌套规则并没有做很好的说明。本文会结合示例，源码来解释下这3点具体是指哪些内容。

首先我们来看下 module.defaultRules 配置是在 `WebpackOptionsDefaulter.js` 当中完成的，得到的结果是：

```javascript
[ { type: 'javascript/auto', resolve: {} },
  { test: /\.mjs$/i,
    type: 'javascript/esm',
    resolve: { mainFields: [Array] } },
  { test: /\.json$/i, type: 'json' },
  { test: /\.wasm$/i, type: 'webassembly/experimental' }]
```

这个数组最终会和你 webpack config 配置的 module.rules 进行 concat 合并成一个数组，并传入 Ruleset 的构造函数当中，得到 ruleset 实例：

```javascript
// NormalModuleFactory.js
class NormalModuleFactory {
  ...
  this.ruleset = new Ruleset(options.defaultRules.concat(options.rules))
  ...
}
```

接下来我们来看下 Ruleset 构造函数里面到底进行了哪些处理：

```javascript
class Ruleset {
  constructor(rules) {
    this.references = Object.create(null);
		this.rules = RuleSet.normalizeRules(rules, this.references, "ref-");
  }

  // 序列化 rules 配置选项
	static normalizeRules(rules, refs, ident) {
		if (Array.isArray(rules)) {
			return rules.map((rule, idx) => {
				return RuleSet.normalizeRule(rule, refs, `${ident}-${idx}`);
			});
		} else if (rules) {
			return [RuleSet.normalizeRule(rules, refs, ident)];
		} else {
			return [];
		}
  }
  
  static normalizeRule(rule, refs, ident) {
    ...
  }
}
```

我们可以看到构造函数里面定义了 normalizeRules 静态方法，它的作用实际就是对传入的 rules 配置进行序列化(格式化)的处理为统一的格式，其中就包含了对于**条件**的序列化。在 module.defaultRules 和 webpack.config 里面有关 rules 的配置你可以理解为最原始的条件配置，这些配置通过 Ruleset 内部提供的方法格式化收敛为统一的过滤条件，最终匹配 loaders 时就是使用格式化过后的这些过滤条件。

有关 webpack.config 里面暴露出来供开发者使用的(常用的)条件配置主要有：

* test 
* include
* exclude
* resouce
* resourceQuery

test/include/exclude 这3项我们平时使用较多的配置实际上是和 resouce 配置是等价的，2者只能存在其一，不能混用。其中test/include 用以匹配满足条件的 loader，而 exclude 用以排除满足条件 loader，resouceQuery 主要是用以在路径中带 query 参数的匹配规则，例如你的模块依赖路径为 `xxx/xxx?type=demo`, resolveQuery 的配置为 `/type=demo/`，那么便会符合对应的匹配规则。这些字段支持的数据类型有：

* string
* function
* RegExp
* Array(数组内部的元素类型为前3者之一)
* Object(仅支持 or/include/test/add/not/exclude字段)

接下来我们看下 Ruleset 内部是如何将原始的配置进行格式的，以及最终格式化所输出的内容。

```javascript
class RuleSet {
  ...
  static normalizeRule(rule, refs, ident) {
    ...
    if (rule.test || rule.include || rule.exclude) {
			condition = {
				test: rule.test,
				include: rule.include,
				exclude: rule.exclude
			};
			try {
				newRule.resource = RuleSet.normalizeCondition(condition);
			} catch (error) {
				throw new Error(RuleSet.buildErrorMessage(condition, error));
			}
    }
    
    if (rule.resource) {
			checkResourceSource("resource");
			try {
				newRule.resource = RuleSet.normalizeCondition(rule.resource);
			} catch (error) {
				throw new Error(RuleSet.buildErrorMessage(rule.resource, error));
			}
    }
    
    if (rule.resourceQuery) {
			try {
				newRule.resourceQuery = RuleSet.normalizeCondition(rule.resourceQuery);
			} catch (error) {
				throw new Error(RuleSet.buildErrorMessage(rule.resourceQuery, error));
			}
    }
    
    if (rule.issuer) {
			try {
				newRule.issuer = RuleSet.normalizeCondition(rule.issuer);
			} catch (error) {
				throw new Error(RuleSet.buildErrorMessage(rule.issuer, error));
			}
		}
    ...
  }

  static normalizeCondition(condition) {
    if (!condition) throw new Error("Expected condition but got falsy value");
    // 如果配置数据类型为 string，那么直接使用 indexOf 作为路径匹配规则
		if (typeof condition === "string") {
			return str => str.indexOf(condition) === 0;
    }
    // 如果为 function 函数，那么使用这个开发者自己定义的 function 作为路径匹配规则
		if (typeof condition === "function") {
			return condition;
    }
    // 如果为正则表达式
		if (condition instanceof RegExp) {
			return condition.test.bind(condition);
    }
    // 如果为一个数组，那么分别处理数组当中的每一个元素，最终返回一个由 orMatcher 包装的函数，就是只要其中一个元素的匹配条件，那么就返回为 true
		if (Array.isArray(condition)) {
			const items = condition.map(c => RuleSet.normalizeCondition(c));
			return orMatcher(items);
		}
		if (typeof condition !== "object") {
			throw Error(
				"Unexcepted " +
					typeof condition +
					" when condition was expected (" +
					condition +
					")"
			);
		}

		// 匹配规则数组
    const matchers = [];
    // 如果为对象类型，那么最终会用一个 matchers 数组将这些条件收集起来
		Object.keys(condition).forEach(key => {
			const value = condition[key];
			switch (key) {
				case "or":
				case "include":
				case "test":
					if (value) matchers.push(RuleSet.normalizeCondition(value));
					break;
				case "and":
					if (value) {
						const items = value.map(c => RuleSet.normalizeCondition(c));
						matchers.push(andMatcher(items)); // andMatcher 必须在 items 里面都匹配
					}
					break;
				case "not":
				case "exclude":
					if (value) {
						const matcher = RuleSet.normalizeCondition(value);
						matchers.push(notMatcher(matcher)); // notMatcher 必须在 matcher 之外
					}
					break;
				default:
					throw new Error("Unexcepted property " + key + " in condition");
			}
		});
		if (matchers.length === 0) {
			throw new Error("Excepted condition but got " + condition);
		}
		if (matchers.length === 1) {
			return matchers[0];
		}
		return andMatcher(matchers);
  }
  ...
}
```

在 normalizeCondition 函数执行后始终返回的是一个函数，这个函数的用途就是接受模块的路径，然后使用你所定义的匹配使用去看是否满足对应的要求，如果满足那么会使用这个 loader，如果不满足那么便会过滤掉。


以上是对于 rule condition 条件的解释，接下来看下 rule 结果的相关解释。简单来讲就是我们使用 condition 来匹配我们需要的 rule 结果，condition 和 rule 是一一对应的关系，rule 结果就是最终我们需要加载这个模块需要使用的所有相关 loader 数组。我们首先来看下哪些配置字段和 rule 结果有强相关性：

* loader
* loaders(Webpack 4.x 已废弃)
* use

这几个对应的配置写法有：

```javascript
{
  module: {
    rules: [
      {
        test: /.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /.scss$/,
        use: [
          'vue-style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              data: '$color: red;'
            }
          }
        ]
      }
    ]
  }
}
```

在 RuleSet 构造函数内部使用静态方法 normalizeUse 方法来输出最终和 condition 对应的 rule 结果：

```javascript
class RuleSet {
  static normalizeUse(use, ident) {
		if (typeof use === "function") {
			return data => RuleSet.normalizeUse(use(data), ident);
		}
		if (Array.isArray(use)) {
			return use
				.map((item, idx) => RuleSet.normalizeUse(item, `${ident}-${idx}`))
				.reduce((arr, items) => arr.concat(items), []);
		}
		return [RuleSet.normalizeUseItem(use, ident)];
	}

	static normalizeUseItemString(useItemString) {
		const idx = useItemString.indexOf("?");
		if (idx >= 0) {
			return {
				loader: useItemString.substr(0, idx),
				options: useItemString.substr(idx + 1)
			};
		}
		return {
			loader: useItemString,
			options: undefined
		};
  }
  
  static normalizeUseItem(item, ident) {
		if (typeof item === "string") {
			return RuleSet.normalizeUseItemString(item);
		}

		const newItem = {};

		if (item.options && item.query) {
			throw new Error("Provided options and query in use");
		}

		if (!item.loader) {
			throw new Error("No loader specified");
		}

		newItem.options = item.options || item.query;

		if (typeof newItem.options === "object" && newItem.options) {
			if (newItem.options.ident) {
				newItem.ident = newItem.options.ident;
			} else {
				newItem.ident = ident;
			}
		}

		const keys = Object.keys(item).filter(function(key) {
			return !["options", "query"].includes(key);
		});

		for (const key of keys) {
			newItem[key] = item[key];
		}

		return newItem;
	}
}
```

经过 normalizeUse 函数的格式化处理，最终的 rule 结果为一个数组，内部的 object 元素都包含 loader/options 等字段：

```javascript
[{
  loader: 'xxx-loader',
  options: {
    data: '$color red'
  }
}, {
  lodaer: 'xxx-loader',
  options: 'a=b&c=d'
}]
```

经过 RuleSet 内部的格式化的处理，最终输出的 rules 为：

```javascript
rules: [
  {
    resource: [Function],
    resourceQuery: [Function],
    use: [{
      loader: 'xxx-loader',
      options: {
        data: '$color red'
      }
    }]
  },
  {
    resource: [Function],
    resourceQuery: [Function],
    use: [{
      loader: 'xxx-loader',
      options: 'a=b&c=d'
    }]
  }
]
```

以上便是 RuleSet 构造函数实例化以及格式化 condition 及 rule 结果的过程。这个过程结束后，便可利用 ruleset 实例上的 exec 进行相关的匹配过滤工作。 

在 webpack 正常的工作流当中，在加载对应的 module 之前首先需要知道加载这个模块具体使用哪些 loader，便是调用 ruleset 实例上的 exec 去过滤对应的 loader。

具体的使用方法为：
```
// NormalModuleFactory.js

this.ruleset.exec({
  resource: resourcePath,  // module 的路径
  realResource:
    matchResource !== undefined
      ? resource.replace(/\?.*/, "")
      : resourcePath,
  resourceQuery,  // module 路径上所带的 query 参数
  issuer: contextInfo.issuer,  // 这个模块的发布者
  compiler: contextInfo.compiler // 这个模块所使用的编译器选项
})

```

接下来我们看下 exec 方法内部具体的实现：

```javascript
class RuleSet {
  ...
  exec(data) {
		const result = [];
		this._run(
			data,
			{
				rules: this.rules // 根据内置的 rules 和传入的 module.rule 合并后生成的 rules
			},
			result
		);
		return result;
  }
  
  _run(data, rule, result) {
		// test conditions
		// 一系列的匹配规则，只有通过这些匹配规则，才会将对应的 loaders 加入到数组中
		if (rule.resource && !data.resource) return false;
		if (rule.realResource && !data.realResource) return false;
		if (rule.resourceQuery && !data.resourceQuery) return false;
		if (rule.compiler && !data.compiler) return false;
		if (rule.issuer && !data.issuer) return false;
		if (rule.resource && !rule.resource(data.resource)) return false; // resource 匹配规则
		if (rule.realResource && !rule.realResource(data.realResource))
			return false;
		if (data.issuer && rule.issuer && !rule.issuer(data.issuer)) return false;
		if (
			data.resourceQuery &&
			rule.resourceQuery &&
			!rule.resourceQuery(data.resourceQuery) // resourceQuery 的匹配规则
		) {
			return false;
		}
		if (data.compiler && rule.compiler && !rule.compiler(data.compiler)) {
			return false;
		}

		// apply
		const keys = Object.keys(rule).filter(key => {
			return ![
				"resource",
				"realResource",
				"resourceQuery",
				"compiler",
				"issuer",
				"rules",
				"oneOf",
				"use",
				"enforce"
			].includes(key);
		});
		for (const key of keys) {
			result.push({
				type: key,
				value: rule[key]
			});
		}

		if (rule.use) {
			const process = use => {
				if (typeof use === "function") {
					process(use(data));
				} else if (Array.isArray(use)) {
					use.forEach(process);
				} else {
					result.push({
						type: "use",
						value: use,
						enforce: rule.enforce
					});
				}
			};
			process(rule.use);
		}

		if (rule.rules) {
			for (let i = 0; i < rule.rules.length; i++) {
				this._run(data, rule.rules[i], result);
			}
		}

		if (rule.oneOf) {
			for (let i = 0; i < rule.oneOf.length; i++) {
				if (this._run(data, rule.oneOf[i], result)) break;
			}
		}

		return true;
	}
}
```

过滤过程的实现应该是非常清晰的，就是递归的根据 ruleset 在实例化的时候创建的各种过滤条件(对应的不同的 Function)，以及传入的不同字段(`resouce/realsource/compiler/issuer/compiler`)，最终输出的数据格式即 webpack 文档上所说的结果为：

```javascript
[{
  type: 'use',
  value: {
    loader: 'vue-style-loader',
    options: {}
  },
  enforce: undefined // 可选值还有 pre/post  分别为 pre-loader 和 post-loader
}, {
  type: 'use',
  value: {
    loader: 'css-loader',
    options: {}
  },
  enforce: undefined
}, {
  type: 'use',
  value: {
    loader: 'sass-loader',
    options: {
      data: '$color red'
    }
  },
  enforce: undefined 
}]
```

### 总结

RuleSet 的使用主要包含了：

1. RuleSet 的实例化过程，即根据 webpack.module.rules 的配置及 webpack 内部的 rules 配置，将不同字段的不同数据类型，例如 string/RegExp/Function 等都转化为对应的过滤函数，因为 webpack 的 rules 为了满足不同的配置需求，设计的还是相对来说很灵活的，对于开发者而且可以使用灵活多样的配置形式，但是收敛到 ruleset 内部便统一转化为过滤函数的形式；

2. exec 方法过滤阶段便是根据传入的不同的配置规则来递归的进行匹配，最终输出被匹配到的 loaders 数组。