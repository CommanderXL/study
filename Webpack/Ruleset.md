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

在 normalizeCondition 函数执行后始终返回的是一个函数，这个函数的用途就是接受模块的路径，然后在内容使用定义好的匹配规则去看是否满足对应的要求。