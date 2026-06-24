
## 1. Agentic Retrieve Code
   
AI Coding 的核心前提，是 Agent 能够快速找到和当前问题相关的代码上下文。但在真实的工程实践中，用户使用自然语言提问，例如“乘车码轮询逻辑在哪里”、“改动了这个 X 函数会影响哪些地方”，相关的代码实现却分散在多个文件、函数、路由和调用链中。LLM 缺乏代码全局感知能力，要完成一个完整的问答，它并不能直接拿着原始的用户 query 去做代码召回，而是通过将用户 query rewrite 为关键词（乘车码轮询逻辑 -> 乘车码|轮询|polling），然后通过关键词探索性的去匹配代码片段，经过多轮循环（grep 关键词 -> read file -> grep 关键词 -> read file -> answer），将碎片化的信息组织成有逻辑性的上下文：

这个过程中有四个问题：

* 上下文碎片化：缺少跨文件的符号关联和依赖关系补全，召回结果可能只是零散代码片段，导致回答不完整或需要多轮补查。
* 检索低效：Agent 依赖 grep / read 反复搜索原始文件，工具调用次数和 token 消耗高；
* 结构盲区：AI 不了解模块间依赖关系、继承链和调用图，容易只看到局部函数，看不到完整实现链路；
* 业务语义到代码的鸿沟：

## 2. RAG 增强检索

开源社区有不少产品去解决上述问题：

> RAG（Retrieval-Augmented Generation）是指一类检索增强的技术方案（Vector 向量只是一种实现的手段），相较于 AI-Native 提供的 bash/grep/glob 多轮检索方式，RAG 会尽量在少的对话轮次里返回和 query 相关的召回内容。
> 开源社区的产品对于实现 RAG 所采用的方案大同小异，主要包括 FTS 全文检索、基于 CodeGraph 的图检索、Vector 语义相似度检索，三者之间对应不同的构建索引&召回策略，这是造成不同产品的召回效果最核心的差异。
> 其中我们对 Mindwiki/Gitnexus/CodeGraph 这3个工具进行了深入的代码魔改及研究。

todo：

1. FTS、索引是什么？
2. 召回是什么？
3. 大概的执行流程；


## 3. RAG 与业务语义

以上 RAG 工具可以一定程度解决文章开头提到的3个问题：上下文碎片化、检索低效和结构盲区。

query 的分类；


## 4. 代码 RAG 在 long-running task 当中的困境

RAG 的方案在实际的项目当中使用主要还是通过：CLAUDE.md、mcp tool description 等 prompt 来告知 LLM 可以使用哪些工具以及对应的使用场景。但是 RAG 工具本身的目标是保证召回内容充分的前提下，让 LLM 在代码召回阶段尽量少的去使用 grep/glob/bash/read 工具，而是通过 RAG 工具去做召回。所以对于 LLM 来说在召回阶段存在使用 RAG工具 vs grep/glob/bash 工具的优先级问题。

RAG 工具和其他的工具调用的场景不一样，例如：cooper mcp tool，这些工具和 grep/glob/bash/read tool 功能正交，LLM 在执行任务时如果识别到某个场景需要调用这个工具，那么自然也就直接调用，而不存在同类工具调用优先级问题。这个问题目前在日常的 AI Coding 环节还好，但是在 long-running task 当中 LLM 到底选择哪个召回工具的优先级就很突出。

当前各业务团队都在尝试 SDD 范式的需求实现。一个需求通过完整的 SDD 范式跑下来往往耗时长，token 消耗多，我们期望可以将 RAG 这套方案融入到 SDD 范式当中，加速 LLM 定位代码的时间并降低 token 消耗。在实际的 SDD 范式的测试过程中，我们发现 RAG 工具调用次数异常少，LLM 主要还是使用 grep/glob/bash tool 来召回。（事实上使用 grep/glob tool 检索代码的次数也非常少，主要是使用 bash tool，里面包裹着 grep/glob 命令。为什么？因为 bash shell 的功能足够强大，不同 shell 命令通过 pipe 可以完成多个任务的执行，效率更高）


**主要原因：RAG 工具的 prompt 是一种弱约束，在 long-running task 当中，LLM 注意力没法保证在代码召回阶段会优先使用 RAG 工具。**

目前开源社区有些产品是利用 hook 来作为 LLM 调用 RAG 调用的强约束，例如 codebase-memory-mcp 通过 grep/glob hook 来注入 RAG 内容，但是这种强约束的效果不一定好：

* 我们通过测试发现在 long-running task 当中，LLM 往往通过 bash shell 取代了 grep/glob 的调用，实际能被 hook 的次数并不多（例如上面通过 cspec 执行的长任务，0次 grep/glob 调用）；
* hook 方式过于粗暴，增加了重复的上下文；