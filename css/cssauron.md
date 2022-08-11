核心是将 css selector 的匹配规则使用场景范围扩大，原本使用于 DOM 节点的匹配，拓展为对于 vDom Tree，json 嵌套数据结构、[js AST](https://github.com/chrisdickinson/cssauron-falafel#readme)等数结构的匹配。

parse 和 match 2个阶段；

