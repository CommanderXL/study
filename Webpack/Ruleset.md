## Ruleset loader过滤器

Ruleset 类主要作用于加载 module 时匹配符合规则的 loader。Ruleset 在内部会有一个默认的 module.defaultRules 配置，在真正加载 module 之前会和你在 webpack config 配置文件当中的自定义 module.rules 进行合并，然后转化成对应的匹配过滤器。

其中 module.defaultRules 配置是在 `WebpackOptionsDefaulter.js` 当中完成的，得到的结果是：

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

我们可以看到构造函数里面定义了 normalizeRules 静态方法，它的作用实际就是对传入的 rules 配置进行序列化(格式化)的处理为统一的格式，具体处理成什么样了后文会具体梳理。
