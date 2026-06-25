
> **RAG（Retrieval-Augmented Generation，检索增强生成）** 是一类在生成答案之前先检索相关上下文的技术方案的统称。FTS 全文检索、基于 CodeGraph 的图检索，向量化 embedding 是实现 RAG 的不同技术方案。本文讨论的代码 RAG，核心目标是：在 AI Coding 场景中，让 LLM 通过少量工具调用就能拿到足够相关的代码上下文，而不是依赖 grep/read 的多轮盲搜。

## 1. Agentic Search
   
AI Coding 的核心前提，是 Agent 能够快速找到和当前问题相关的代码上下文。但在真实的工程实践中，用户使用自然语言提问，例如“乘车码轮询逻辑在哪里”、“改动了这个 X 函数会影响哪些地方”，相关的代码实现却分散在多个文件、函数、路由和调用链中。LLM 缺乏代码全局感知能力，要完成一个完整的问答，它并不能直接拿着原始的用户 query 去做代码召回，而是通过将用户 query rewrite 为关键词（例如：乘车码轮询逻辑 -> 乘车码|轮询|polling），然后通过关键词探索性的去匹配代码片段，经过多轮循环（grep 关键词 -> read file -> grep 关键词 -> read file -> answer），将碎片化的信息组织成有逻辑性的上下文：

这个过程中有四个问题：

* 上下文碎片化：缺少跨文件的符号关联和依赖关系补全，召回结果可能只是零散代码片段，导致回答不完整或需要多轮补查。
* 检索低效：Agent 依赖 grep / read 反复搜索原始文件，工具调用次数和 token 消耗高；
* 结构盲区：AI 不了解模块间依赖关系、继承链和调用图，容易只看到局部函数，看不到完整实现链路；
* 业务语义到代码的鸿沟：用户描述问题时使用的是业务语言（"乘车码轮询"），而代码库中存储的是工程语言（函数名、变量名）。两者之间存在天然的语义断层——同一个业务概念可能对应多个命名各异的函数，同一个函数名也可能承载多种业务语义。

## 2. RAG 增强检索

开源社区有不少产品去解决上述问题，这些产品对于实现 RAG 所采用的方案大同小异，主要包括 FTS 全文检索、基于 CodeGraph 的图检索、Vector 语义相似度检索，三者之间采用了**不同的构建索引&召回策略，这是造成不同产品的召回效果最核心的差异**。

在此之前，先简单介绍下两个概念：**索引**和**召回**：

- 索引：提前把代码库整理成几张方便查询的“表”；
- 召回：用户提问时，先查这些“表”，把可能相关的代码片段找出来。

### 索引

**索引（Index）**是在离线阶段先把代码拆解、抽取、存储成更容易查询的数据结构。以一个函数为例：

```ts
// src/subpackage/estimate/utils/location
export function initFromLocation(params) {
  // 根据定位初始化起点
}
```

索引阶段不会只保存这一段原始文本，而是会依据代码内容转化为几类结构化的数据：

```text
代码块索引：
  file: src/subpackage/estimate/utils/location.ts
  symbol: initFromLocation
  qualified_name: src/subpackage/estimate/utils/location.ts::initFromLocation
  signature: initFromLocation(params)
  body: export function initFromLocation...
  comment: 根据定位初始化起点

Graph 关系：
  initFromLocation
    <- called by pageInit
    -> calls getCurrentLocation
    -> calls updateFromPoi

Vector 向量：
  Array<Float64>
```

这些数据存储形式可能是 sqlite、json、向量库或本地缓存，但核心思路类似：把原始代码变成可查询的结构化数据。不同的索引内容服务于不同的召回策略：

* 代码块索引 -> FTS 召回；
* Graph 关系 -> 依赖召回；
* Vector 向量 -> 语义相似度召回；

### 召回

**召回（Retrieval）**就是用户 query 进来后，从这些索引里分别把候选代码上下文捞出来。

比如用户问：

```text
initFromLocation 在小程序和 RN 下有什么区别？
```

LLM 首先会将这段自然语义的描述转化为几个检索关键词：`initFromLocation|小程序|miniprogram|RN`：

```text
函数 symbol 名: initFromLocation
平台关键词: 小程序 / miniprogram / RN
```

然后去不同索引里查：

```text
FTS:
  搜 initFromLocation
  搜 RN / 小程序 / miniprogram

CodeGraph:
  找 initFromLocation 的定义
  找谁调用了 initFromLocation
  找 initFromLocation 内部又调用了哪些函数

Vector:
  找和“定位初始化、平台差异、RN 小程序”语义接近的代码片段
```

这些查询会返回一批候选结果，例如函数定义、调用方、平台判断分支、相关配置文件、类型声明等。较完整的 RAG pipeline 一般会对这些候选结果做 rerank、去重、图扩展、上下文预算裁剪，最终拼成一段适合放进 prompt 的上下文。

常见的召回策略大概可以分成三类：

1. **FTS 全文检索**：解决“关键词在哪里出现过”。例如搜 `initFromLocation` 能快速找到函数定义和引用位置；搜 `polling` / `cancelOrder` 能找到包含这些词的代码片段。它依赖词面匹配，优点是稳定、可解释，缺点是 query 里的词和代码里的词对不上时容易漏召回。
2. **CodeGraph 图检索**：解决“命中一个点之后，相关链路在哪里”。例如 FTS 找到了 `initFromLocation` 的定义，CodeGraph 可以继续补它的 caller/callee、父类/子类、同文件相关 symbol。它本质上是在沿代码结构补上下文。
3. **Vector 语义相似度检索**：解决“词不一样但意思接近”。索引阶段先把代码 chunk 转成 embedding，查询阶段再把用户 query 转成 embedding，通过向量近邻搜索找语义相近的片段。它能补充 FTS 漏掉的结果，但也更依赖 embedding 模型质量，容易引入看起来相关但实际不关键的内容。

所以一次典型的 RAG 执行流程大概是：

1. **Query 预处理**：识别出 `initFromLocation` 是明确的代码 symbol，同时保留“小程序”“RN”“区别”等语义关键词；
2. **多路召回**：FTS 根据 `initFromLocation` 精确匹配函数定义和引用位置；CodeGraph 基于符号关系找到 caller/callee、同文件相关逻辑；Vector 检索补充命名不完全一致但语义接近的代码片段；
3. **结果融合与排序**：把多路结果合并，按照关键词重合度、符号名命中、调用关系距离、文件多样性等信号重新排序；
4. **上下文扩展**：对高置信度结果继续补齐必要的邻接上下文，例如函数所在类、调用方分支、平台判断逻辑、相关配置；
5. **预算裁剪**：在 token 限制内保留最关键的代码片段，去掉重复或低相关内容；
6. **交给 LLM 推理**：LLM 基于召回上下文进行归纳、比较和回答。

和原始的 grep / read 循环相比，RAG 的价值不在于“能不能搜到某个词”，而在于把“搜词、读文件、顺调用链扩展、去重、排序、裁剪”这套动作产品化、自动化。它将 Agent 原本需要多轮工具调用才能拼出来的上下文，压缩成一次或少数几次检索调用，从而降低 token 消耗，并提升召回结果的结构完整性。


## 3. RAG 与业务语义

以上 RAG 工具可以一定程度解决文章开头提到的3个问题：上下文碎片化、检索低效和结构盲区。但是前提是用户 query 偏工程语义：

**工程语义 query**——问题中包含明确的代码 symbol 或工程术语，语义聚焦，和代码命名体系高度重合。例如：

- "initFromLocation 在小程序和 RN 场景下有什么区别？"
- "老 gulfstream 页面和新 trip 跨端页之间如何通过 jump_table/match_cross_end_url 来决策跳转逻辑？什么时候降级到老页面？"

这类 query 中的关键词（函数、方法名）本身就是代码库里的 symbol。RAG 工具（FTS + CodeGraph）非常擅长处理这类问题，可以直接用关键词定位到目标文件和函数，再通过 CodeGraph 补全依赖链路，这套方案召回精度高、LLM 可以通过少量的 RAG 工具调用次数就能获得具体代码实现。

除了这种有明确代码 symbol 的 query 类型外，还有偏“业务语义 query”：

**业务语义 query**——问题用的是业务语言，没有直接对应的代码 symbol，语义背后是多个页面、组件、函数的集合。例如：

- "等待应答页用户点取消后，预取消挽留弹窗和真正取消订单是怎么串起来的？"

"等待应答页"不是某个具体的函数或类名，它是一个业务概念，在代码里可能分散为多个页面组件、函数、状态管理，它和代码关键词不是一对一的关系。面对这类 query，LLM 将 query rewrite 为中英文关键词、同义词去“碰运气”定位文件(grep/glob)，判断召回内容是否和这个业务场景有关，再顺着线索深入阅读代码(read)，如此反复。

对于特定业务术语来说，LLM embedding model 肯定没有对应的业务训练数据，所以在 query rewrite 阶段并不能将这些业务术语转化为有效的代码关键字，因此 RAG 工具在这种场景下提供的帮助有限。

### Bigram

在上述 RAG 工具中，MindWiki 专门针对业务语义召回作了一些尝试：项目领域术语自动抽取。

大致的实现思路就是：在索引阶段，扫描仓库中所有函数/类名（英文）与 docstring（含中文注释）的共现关系，建立中文注释到代码符号的映射：

举个例子：

```js
/**
 * 检查订单价格防倒挂逻辑
 */
function checkAntiPriceReverse(order) {
  // ...
}
```

索引阶段可以从函数名中拆出英文 token：

```text
check / anti / price / reverse
```

同时从中文注释中按 bigram 拆出连续片段：

```text
检查 / 查订 / 订单 / 单价 / 价格 / 格防 / 防倒 / 倒挂 / 挂逻 / 逻辑
```

如果多个函数名和注释里反复出现 `anti / price / reverse` 与 `防倒 / 倒挂 / 价格` 这类共现关系，就可以推断出一个候选映射：

```text
防倒挂 -> anti_price_reverse
价格 -> price
```

查询"防倒挂"时，这条映射会将 query 扩展为 `防倒挂｜anti_price_reverse`。

但这个方案存在两个根本性局限：

**局限一：注释必须写出业务语义。** bigram 能建立有效映射，依赖的是“英文函数名”和“中文业务词”同时出现在同一段代码附近。例如下面这种注释是有效的：

```js
/**
 * 检查订单价格防倒挂逻辑
 */
function checkAntiPriceReverse(order) {}
```

因为函数名里有 `anti / price / reverse`，注释里有 `价格 / 防倒 / 倒挂`，两边能建立稳定共现关系。但真实项目里的注释经常是下面这种：

```js
/**
 * 遍历列表取最大值
 */
function checkAntiPriceReverse(order) {}
```

这段注释虽然存在，但没有写出“防倒挂”这个业务词。bigram 只能从注释里抽到 `遍历 / 列表 / 最大值`，无法知道它和 `anti_price_reverse` 的业务关系。更糟的是，如果和业务语义无关的注释大量出现，构建索引阶段可能会把“最大值”“列表”这类无关词也纳入候选映射，最终让召回结果噪音变多。

**局限二：很多业务问题不是一个函数能表达的。** 很多真实 query 不是在问“某个业务词对应哪个函数”，而是在问“某个业务流程是怎么串起来的，某个业务流程的功能是什么”。例如：

```text
等待应答页用户点取消后，预取消挽留弹窗和真正取消订单是怎么串起来的？
```

这个问题背后至少涉及几类代码：

```text
页面入口：等待应答页
用户动作：点击取消按钮
前置接口：请求预取消接口，判断是否展示挽留弹窗
弹窗组件：展示挽留文案、按钮和交互
确认动作：用户确认取消
取消接口：提交真正取消订单请求
状态更新：订单状态变化，页面跳转到取消态
```

这里没有一个单独的 `cancelOrder` 或 `preCancel` 函数可以完整代表这个业务语义。即使 bigram 能把“取消”映射到某个 `cancelOrder` 函数，也只能命中流程里的一个点，无法自动补齐“按钮在哪里触发、挽留弹窗由谁展示、预取消接口和真正取消接口如何衔接、状态变化后页面怎么切换”这些上下文。也就是说，bigram 解决的是“业务词到代码点位”的问题（虽然从测试的结果来看，不一定属于效果正向的索引&召回手段，但是这个思路还是对的），而不是“业务流程到代码链路”的问题。

### LLM Wiki 与业务知识库

前段时间爆火的 [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 虽然提供的是个人知识库的构建思路，但是里面的 [Index 的核心思想](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f#indexing-and-logging) 同样也能运用在代码的索引&召回场景当中：

> index.md is content-oriented. It's a catalog of everything in the wiki — each page listed with a link, a one-line summary, and optionally metadata like date or source count. Organized by category (entities, concepts, sources, etc.). The LLM updates it on every ingest. When answering a query, the LLM reads the index first to find relevant pages, then drills into them. This works surprisingly well at moderate scale (~100 sources, ~hundreds of pages) and avoids the need for embedding-based RAG infrastructure.

乘客业务泛前端知识库就是这种思路的一个具体落地，在代码仓库里面提供了一层很薄的业务语义到代码的索引层：

```text
docs/
  biz/
    index.md          # 业务页面总索引：页面ID、说明、主实现文件、页面索引
    pages/            # 页面索引：页面定位、入口组件、组件列表、接口、数据管理
    modules/          # 页面容器/业务组件文档：组件职责、文件路径、子组件、数据管理
```

整个索引层成树状结构：

* `index.md` 入口索引建立**业务语义和核心文件实体及页面索引**的关系；
* pages 页面索引建立**组件文件实体及组件索引**的关系；

当用户问“等待应答页取消流程”这种需要依据业务语义定位代码的 query 时，LLM 可以先通过 Read 入口索引 `index.md` 直接定位到 `gulfstream-hold-v6.0` / `gulfstream-hold-v1.x` 这些具体的业务实体页面和对应的实体组件及索引内容，从而可以快速定位到具体的代码实现。

业务知识库本身很薄，核心提供的是业务语义到文件位置粒度的索引。这套方案和 bigram 方案的差异也非常明显：

* bigram 时尝试建立“中文注释 -> 代码符号间"的点状映射（而代码当中的中文注释和代码符号间并不是严格的语义和代码的映射关系，强依赖注释内容的书写质量）；
* 业务知识库的索引则是维护“业务语义 -> 多个代码单元协作关系”的面状映射；

业务知识库在解决业务语义 query 的问题时效果还是不错的。在 single Q&A benchmark 的测试当中任务执行耗时、token消耗及 tool 调用次数都有所优化。

### 业务知识库和 RAG 间的关系


## 4. 代码 RAG 在 long-running task 当中的困境


RAG 的方案在实际的项目当中使用主要还是通过：CLAUDE.md、mcp tool description 等 prompt 来告知 LLM 可以使用哪些工具以及对应的使用场景。但是 RAG 工具本身的目标是保证召回内容充分的前提下，让 LLM 在代码召回阶段尽量少的去使用 grep/glob/bash/read 工具，而是通过 RAG 工具去做召回。所以对于 LLM 来说在召回阶段存在使用 RAG工具 vs grep/glob/bash 工具的优先级问题。

RAG 工具和其他的工具调用的场景不一样，例如：cooper mcp tool，这些工具和 grep/glob/bash/read tool 功能正交，LLM 在执行任务时如果识别到某个场景需要调用这个工具，那么自然也就直接调用，而不存在同类工具调用优先级问题。这个问题目前在日常的 AI Coding 环节(single Q&A)还好，但是在 long-running task 当中 LLM 到底选择哪个召回工具的优先级就很突出。

当前各业务团队都在尝试 SDD 范式的需求实现。一个需求通过完整的 SDD 范式跑下来往往耗时长，token 消耗多，我们期望可以将 RAG 这套方案融入到 SDD 范式当中，加速 LLM 定位代码的时间并降低 token 消耗。在实际的 SDD 范式的测试过程中，我们发现 RAG 工具调用次数异常少，LLM 主要还是使用 grep/glob/bash tool 来召回。（事实上使用 grep/glob tool 检索代码的次数也非常少，主要是使用 bash tool，里面包裹着 grep/glob 命令。为什么？因为 bash shell 的功能足够强大，不同 shell 命令通过 pipe 可以完成多个任务的执行，效率更高）


**主要原因：RAG 工具的 prompt 是一种弱约束，在 long-running task 当中，LLM 注意力没法保证在代码召回阶段会优先使用 RAG 工具。**

目前开源社区有些产品是利用 hook 来作为 LLM 调用 RAG 调用的强约束，例如 codebase-memory-mcp 通过 grep/glob hook 来注入 RAG 内容，但是这种强约束的效果不一定好：

* 我们通过测试发现在 long-running task 当中，LLM 往往通过 bash shell 取代了 grep/glob 的调用，实际能被 hook 的次数并不多（例如上面通过 cspec 执行的长任务，0次 grep/glob 调用）；
* hook 方式过于粗暴，增加了重复的上下文；

在 long-running task 当中，影响结果输出的变量很多，例如计算资源等等。

由代码 RAG 在 long-running task 当中遇到的问题进而引申出
