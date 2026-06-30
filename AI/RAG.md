
> **RAG（Retrieval-Augmented Generation，检索增强生成）** 是一类在生成答案之前先检索相关上下文的技术方案的统称。FTS 全文检索、基于 CodeGraph 的图检索，向量化 embedding 是实现 RAG 的不同技术方案。
> 由于这部分的内容涉及到过多的技术细节，没法在文章里面呈现的面面俱到；

## 1. Agentic Search
   
AI Coding 的核心前提，是 Agent 能够快速找到和当前问题相关的代码上下文。但在真实的工程实践中，用户使用自然语言提问，例如“乘车码轮询逻辑在哪里”、“改动了这个 X 函数会影响哪些地方”，相关的代码实现却分散在多个文件、函数、路由和调用链中。LLM 缺乏代码全局感知能力，要完成一个完整的问答，它并不能直接拿着原始的用户 query 去做代码召回，而是通过将用户 query rewrite 为关键词（例如：乘车码轮询逻辑 -> 乘车码|轮询|polling），然后通过关键词探索性的去匹配代码片段，经过多轮循环（grep 关键词 -> read file -> grep 关键词 -> read file -> answer），将碎片化的信息组织成有逻辑性的上下文：

这个过程中有四个问题：

* 上下文碎片化：缺少跨文件的符号关联和依赖关系补全，召回结果可能只是零散代码片段，导致回答不完整或需要多轮补查。
* 检索低效：Agent 依赖 grep / read 反复搜索原始文件，工具调用次数和 token 消耗高；
* 结构盲区：AI 不了解模块间依赖关系、继承链和调用图，容易只看到局部函数，看不到完整实现链路；
* 业务语义到代码的鸿沟：用户描述问题时使用的是业务语言（"乘车码轮询"），而代码库中存储的是工程语言（函数名、变量名）。两者之间存在天然的语义断层——同一个业务概念可能对应多个命名各异的函数，同一个函数名也可能承载多种业务语义。

## 2. RAG 增强检索

开源社区有不少产品去解决上述问题，这些产品对于实现 RAG 所采用的方案大同小异，主要包括 FTS 全文检索、基于 CodeGraph 的图检索、Vector 语义相似度检索。要理解这些工具之间的差异，先看下两个概念：**索引**和**召回**：

- 索引：提前把代码库整理成几张方便查询的“表”；
- 召回：用户提问时，先查这些“表”，把可能相关的代码片段找出来。

### 索引

**索引（Index）** 是先把代码拆解、抽取、存储成更容易查询的数据结构。以一个函数为例：

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

这些数据存储形式可能是 sqlite、json、向量库或本地缓存，但核心思路类似：**把原始代码变成可查询的结构化数据**。不同的索引内容服务于不同的召回策略：

* 代码块索引 -> FTS 召回；
* CodeGraph -> 依赖召回；
* Vector 向量 -> 语义相似度召回；

### 召回

**召回（Retrieval）** 就是接受用户 query 后，从之前构建的索引里分别把候选代码上下文捞出来。

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
3. **Vector 语义相似度检索**：解决“词不一样但意思接近”。索引阶段先把代码文本通过 embedding model 转换成 vector，查询阶段再把用户 query 转成 vector，它依赖 embedding 模型质量，容易引入看起来相关但实际不关键的内容。

一次典型的 RAG 执行流程大概是：

1. **Query 预处理**：识别出 `initFromLocation` 是明确的代码 symbol，同时保留“小程序”“RN”“区别”等语义关键词；
2. **多路召回**：FTS 根据 `initFromLocation` 精确匹配函数定义和引用位置；CodeGraph 基于符号关系找到 caller/callee、同文件相关逻辑；Vector 检索补充命名不完全一致但语义接近的代码片段；
3. **结果融合与排序**：把多路结果合并，按照关键词重合度、符号名命中、调用关系距离、文件多样性等信号重新排序；
4. **交给 LLM 推理**：LLM 基于整个召回上下文进行归纳、比较和回答。

接下来再来看社区里的几个代码 RAG 工具。它们的整体方案相似，但采用了**不同的构建索引&召回策略，这是造成不同产品召回效果差异的核心原因**。

下表是几个代码 RAG 工具在索引和召回策略上的横向对比：

| 工具 | RAG 方案 | 索引策略 | 召回策略 | 备注 |
|------|----------|----------|----------|------|
| MindWiki | FTS + CodeGraph + Vector | FTS Index：Symbol name + File Path + 函数体源码（固定窗口长度）； * Vector Index：chunk-base；CodeGraph | `hybrid_search`：FTS/BM25 + Vector 通过 RRF 混合排序；再做 CodeGraph 扩展 | 更偏混合检索，代码正文会参与 FTS/Vector 召回 |
| GitNexus | FTS + CodeGraph + Vector | FTS Index：Symbol name + File Path + 函数体源码（symbol 上下两行）；Vector Index：chunk-base；CodeGraph | `hybrid_search`：FTS/BM25 + Vector 通过 RRF 混合排序；再做 CodeGraph 扩展 | Vector chunk 基于 symbol 上下文切分，函数体也参与 embedding |
| Code-Review-Graph | FTS + CodeGraph + Vector | FTS Index：Symbol name + File Path；Vector Index：Symbol name、签名、参数等内容压缩成语义向量（函数体源码不参与 embedding）；CodeGraph | `hybrid_search`：FTS/BM25 + Vector 通过 RRF 混合排序；再做 CodeGraph 扩展 | Vector 更偏符号摘要，不直接 embedding 函数体源码 |
| Codebase-memory-mcp | FTS + CodeGraph + Vector | FTS Index：Symbol name + File Path；Vector Index：Symbol name、签名、函数体内 Identifier token、文件路径等内容压缩成语义向量；CodeGraph | `hybrid_search`：FTS/BM25 + Vector 通过 RRF 混合排序；再做 CodeGraph 扩展 | Vector 不直接使用完整函数体源码，而是使用 symbol、签名、docstring、body identifiers、调用邻居等摘要信息 |
| CodeGraph | FTS + CodeGraph | FTS：Symbol name + File Path；CodeGraph | FTS/BM25；CodeGraph 扩展 | 不做 Vector RAG，更强调代码检索中精确符号匹配比语义相似更重要；benchmark、token 消耗和耗时等数据较好 |
| Graphify | FTS + CodeGraph | FTS Index：Symbol name + File Path；CodeGraph | FTS/BM25；CodeGraph 扩展 | 不做 Vector RAG，更强调结果可解释性和确定性 |

从这几个开源产品的索引&召回策略的设计上来看：

* **FTS + CodeGraph 基本是代码 RAG 的标配。** FTS/BM25 负责做精确符号和关键词定位，CodeGraph 负责沿调用关系、引用关系继续扩展上下文。两者结合后，**召回结果可解释、确定性强**。
* 在索引策略的设计上，产品间最大的差异是**是否引入 Vector embedding 以及函数体的源码是否参与索引构建**流程：
  * FTS Index：
    * MindWiki / GitNexus 会把函数体源码也纳入索引构建，在后续的召回策略当中，**函数体内的代码也会参与召回流程最终影响召回结果**；
    * 其他工具会更“克制”，主要索引 symbol name、file path 等精确字段，函数体源码不参与索引构建；
  * Vector Index：
    * MindWiki / GitNexus 让函数体源码参与 embedding 流程；
    * 而 Codebase-memory-mcp/Code-Review-Graph 只把**精确符号、签名、参数等显示信息压缩成语义向量**，而函数体源码不参与 embedding；相较于将源码参与 embedding 的设计来说，向量语义会更加聚焦；
* 索引设计是召回结果的最大的影响因素：
  * Vector embedding 的价值在于**扩大语义召回范围，但它的效果更难评估和解释**。FTS 的命中依据是关键词，而 Vector 只能说明 query 和代码 chunk 在向量空间中更接近。至于为什么接近、接近的是业务语义、代码命名还是局部实现细节，往往不容易解释。Vector 召回更依赖 embedding 内容、chunk 切分、模型质量和混排权重，如果想稳定调优非常困难（这也是 CodeGraph 及 Graphify 两个产品没有引入 Vector Embedding 的主要原因之一）。
  * Vector 召回：是否引入 Vector、Vector embedding 什么内容、以及如何做 FTS/BM25 + Vector 混合排序，都会直接影响最终返回给 LLM 的上下文质量。Vector 会把召回依据从精确符号匹配扩展到语义相似匹配，召回覆盖面变大，但排序依据更依赖 embedding 模型和混排权重，**结果的可解释性和确定性会弱于纯 FTS/BM25 的方案**；
  * 函数体是否参与索引：对于函数体参与索引构建的方案（Mindwiki / GitNexus）来说，不管是通过 FTS 还是 Vector 召回，函数体内部的局部变量、分支逻辑、临时计算、工具方法调用都会参与匹配，召回覆盖面更大，但也更容易把局部实现噪音提前带入候选结果；而只索引 symbol、签名、参数、路径（Codebase-memory-mcp / Code-Review-Graph）等信息的方案，更接近人读代码时“先定位入口，再阅读实现”的过程，召回的结果相较于函数体参与索引的方案通常更聚焦、更可解释;


## 3. RAG 与业务语义

第二章简答聊了下 RAG 工具，主要解决的是“如何更快、更完整地从代码索引中召回相关上下文”。但它们能发挥多大作用，强依赖用户 query 和代码索引之间是否存在稳定的匹配关系。这里把 query 分成两类：**工程语义 query** 和 **业务语义 query**。

### 工程语义 query：RAG 擅长的场景

工程语义 query 指的是问题中包含明确的代码 symbol 或工程术语，它们语义聚焦，和代码命名高度重合。例如：

- "initFromLocation 在小程序和 RN 场景下有什么区别？"
- "老 gulfstream 页面和新 trip 跨端页之间如何通过 jump_table/match_cross_end_url 来决策跳转逻辑？什么时候降级到老页面？"

这类 query 中的关键词（函数、方法名）本身就是代码库里的 symbol。RAG 工具（FTS + CodeGraph）非常擅长处理这类问题，可以直接用关键词定位到目标文件和函数，再通过 CodeGraph 补全依赖链路，这套方案召回精度高、LLM 可以通过少量的 RAG 工具调用次数就能获得具体代码实现。

RAG 在这里解决的是第一章提到的三个问题：上下文碎片化、检索低效和结构盲区。

### 业务语义 query：RAG 的短板

业务语义 query 指的是问题用的是业务语言，没有直接对应的代码 symbol，某个语义词背后往往是多个页面、组件、函数和状态流转的集合。例如：

- "等待应答页用户点取消后，预取消挽留弹窗和真正取消订单是怎么串起来的？"

"等待应答页"不是某个具体的函数或类名，它是一个业务概念，在代码里可能分散为页面组件、函数、接口和状态管理。面对这类 query，LLM 往往只能先把 query rewrite 为若干中英文关键词、同义词，再用 grep/glob 去“碰运气”定位文件；命中一些线索后，再继续 read 代码判断它是否真的属于这个业务场景，如此反复。

这类问题的困难在于：业务术语并不一定出现在代码命名里，LLM embedding model 也不一定理解项目内部的业务词。因此，即使底层 RAG 工具有 FTS、CodeGraph、Vector，也很难凭空把“等待应答页”“防倒挂”“乘车码轮询”这类业务语义稳定映射到正确代码位置。

### Bigram

MindWiki 针对业务语义召回做过一个尝试：项目领域术语自动抽取。它期望**在索引阶段提前建立“中文业务词 -> 代码符号”的映射**。

大致实现思路是：扫描仓库中所有函数/类名（英文）与 docstring（含中文注释）的共现关系，尝试从中抽取业务词和代码 symbol 的对应关系。

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

这段注释虽然存在，但没有写出“防倒挂”这个业务词。bigram 只能从注释里抽到 `遍历 / 列表 / 最大值`，无法知道它和 `anti_price_reverse` 的业务关系。此外，**如果和业务语义无关的注释大量出现，构建索引阶段可能会把“最大值”“列表”这类无关词也纳入候选映射，最终让召回结果噪音变多**。

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

这里没有一个单独的 `cancelOrder` 或 `preCancel` 函数可以完整代表这个业务语义。即使 bigram 能把“取消”映射到某个 `cancelOrder` 函数，也只能命中流程里的一个点，无法自动补齐“按钮在哪里触发、挽留弹窗由谁展示、预取消接口和真正取消接口如何衔接、状态变化后页面怎么切换”这些上下文。也就是说，bigram 解决的是“业务词到代码点位”的问题，而不是“业务流程到代码链路”的问题。

从内部测试结果看，这套 Bigram 方案并没有拿到明确收益，甚至可能因为引入噪音带来负向效果。但它仍然提供了一个重要方向：**业务语义不能只依赖 query 阶段临时猜关键词，而应该在索引阶段提前建立到代码的连接**。

### LLM Wiki 与业务知识库

Bigram 是从“词”这个粒度去补业务语义，但业务问题通常不是一个词，而是一组页面、模块、接口和状态之间的关系。因此更有效的方式，是建立一层结构化业务知识库，让业务语义先落到稳定代码锚点，再回到源码做精确验证。

前段时间爆火的 [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 虽然提供的是个人知识库构建思路，但其中 [Index 的核心思想](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f#indexing-and-logging) 同样可以运用在代码索引和召回场景中：

> index.md is content-oriented. It's a catalog of everything in the wiki — each page listed with a link, a one-line summary, and optionally metadata like date or source count. Organized by category (entities, concepts, sources, etc.). The LLM updates it on every ingest. When answering a query, the LLM reads the index first to find relevant pages, then drills into them. This works surprisingly well at moderate scale (~100 sources, ~hundreds of pages) and avoids the need for embedding-based RAG infrastructure.

乘客业务泛前端知识库就是这种思路的一个具体落地。它的目标不是把所有源码解释一遍，而是在代码仓库里提供一层很薄的、结构化的业务语义索引，让 LLM 可以先按业务概念定位到代码锚点，再回到源码完成具体的阅读、判断和理解。

从**结构设计**上看，知识库不是平铺的 markdown 集合，而是按知识类型分层：

```text
docs/
  architecture/       # 架构索引：项目分层、核心依赖、公共能力
  biz/
    index.md          # 业务页面总索引
    pages/            # 页面级知识
    modules/          # 页面容器 / 业务组件知识
    stores/           # Store 定位知识
  coding-standards/   # 编码规范和约束
```

其中最核心的是 `biz` 目录，它按照“页面 -> 模块 -> Store/接口/源码”的方向组织业务知识：

```text
docs/biz/index.md
  -> docs/biz/pages/*.md
      -> docs/biz/modules/p-*.md   # 页面容器
      -> docs/biz/modules/c-*.md   # 业务组件
          -> docs/biz/stores/*.md
          -> 源码文件 / 接口路径
```

从**内容设计**上看，每类文档只承载自己这一层应该回答的问题，不把所有细节都塞进同一篇文档。这里要特别强调：知识库只保存“帮助定位的信息”，不保存“源码实现细节”。具体代码逻辑仍然由 LLM 根据索引定位到源码后自行阅读和理解。

1. **入口索引 `docs/biz/index.md`**：回答“这个业务场景对应哪个页面”。它用表格维护页面名称、页面唯一 ID、业务说明、主实现文件、页面文档链接。例如“平台等待应答 6.0”会被索引到 `gulfstream-hold-v6.0`，并指向对应页面文档和主实现文件；
2. **页面文档 `docs/biz/pages/*.md`**：回答“这个页面由哪些业务模块组成”。它记录页面定位、访问路径、页面框架概览、入口组件、组件列表、调用接口、数据管理。页面文档不直接展开组件内部逻辑，而是把关键模块继续链接到组件/容器文档；
3. **模块文档 `docs/biz/modules/*.md`**：回答“这个页面容器或组件负责什么”。容器文档描述公共组件、状态切换、共享 URL 参数和 Store；组件文档描述组件职责、文件路径、子组件、接口和数据依赖。这里的关键是用源文件路径作为稳定锚点，避免同一个组件被不同业务页面重复解释；

这套设计有几个比较关键的取舍：

* **入口是业务语义，不是代码目录。** 用户不会问“`src/subpackage/gulfstream/.../main.mpx` 做了什么”，更常问“等待应答页取消流程在哪里”。所以第一层索引按业务阶段、业务页面、业务场景组织，而不是按文件夹组织。
* **内容是定位索引，不是代码细节。** 页面文档只记录入口组件、关键接口、Store、组件关系等可帮助定位的信息；可以直接从源码读到的实现细节不固化到文档里。知识库负责告诉 LLM “应该去哪里读代码”，而不是提前替 LLM 把代码逻辑总结完。

当用户问“等待应答页取消流程”这种需要依据业务语义定位代码的 query 时，LLM 可以先通过 Read 入口索引 `index.md` 直接定位到 `gulfstream-hold-v6.0` / `gulfstream-hold-v1.x` 这些具体的业务实体页面和对应的实体组件及索引内容，从而可以快速定位到具体的代码实现。

业务知识库本质上是一层“业务语义 -> 页面/模块/组件文件”的结构化索引。这套方案和 bigram 方案的差异也非常明显：

* bigram 尝试建立“中文注释 -> 代码符号间"的点状映射（而代码当中的中文注释和代码符号间并不是严格的语义和代码的映射关系，强依赖注释内容的书写质量）；
* 业务知识库的索引则是维护“业务语义 -> 多个代码单元协作关系”的面状映射；

业务知识库在解决业务语义 query 的问题时效果还是不错的。在 single Q&A benchmark 的测试当中任务执行耗时、token消耗及 tool 调用次数都有所优化。

### 业务知识库和 RAG 间的关系

业务知识库和 RAG 的目标是一致的：都是为了让 LLM 更快、更精准地定位到和当前问题相关的代码，减少盲目的 grep/read 和多轮上下文探索。两者不是互斥关系，而是面向不同类型的索引和问题场景。

业务知识库解决的是**业务语义到代码的索引**。它面向的是“等待应答页取消流程”“乘车码轮询逻辑”“宠物出行表单”这类 query，用户描述的是业务概念或业务流程，query 里不一定包含明确的代码 symbol。业务知识库通过页面索引、模块索引、组件索引，把这些业务语义先映射到一组稳定的代码文件位置。

RAG 解决的是**代码 symbol 和代码上下文的精确召回**。它面向的是“`initFromLocation` 在小程序和 RN 下有什么区别”“`cancelOrder` 的调用链是什么”这类已经包含明确 symbol 的 query；也包括 LLM rewrite 后已经提取出有效 symbol 的场景。此时 FTS、CodeGraph 能围绕这些 symbol 做更精确的定位、调用关系扩展和上下文补全。

两者结合后，LLM 可以根据 query 类型选择合适的代码召回方式：

* 业务语义 query 先走业务知识库定位代码锚点；
* 工程语义 query 直接走 RAG 精确召回；

## 4. 代码 RAG 在 long-running task 当中的困境

RAG 的方案在实际的项目当中使用主要还是通过：CLAUDE.md、mcp tool description 等 prompt 来告知 LLM 可以使用哪些工具以及对应的使用场景。RAG 工具本身的目标是保证召回内容充分的前提下，让 LLM 在做精确代码召回阶段尽量少的去使用 grep/glob/bash/read 工具，而是通过 RAG 工具去做召回。所以对于 LLM 来说在召回阶段存在使用 **RAG 工具 vs grep/glob/bash 工具**的优先级问题，具体表现就是：在 long-running task 当中，涉及到代码召回的工具调用还是退化到 grep/glob，使用 RAG 工具召回代码的次数极少。

RAG 工具和其他的工具调用的场景不一样，例如：cooper mcp tool，这些工具和 grep/glob/bash/read tool 功能正交，LLM 在执行任务时如果识别到某个场景需要调用这个工具，那么自然也就直接调用，而不存在同类工具调用优先级问题。这个问题目前在日常的 AI Coding 环节(single Q&A)还好，但是**在 long-running task 当中 LLM 到底选择哪个召回工具的优先级问题就很突出**。

当前各业务团队都在尝试 SDD 范式的需求实现。一个需求通过完整的 SDD 范式跑下来往往耗时长，token 消耗多，我们期望可以将 RAG 这套方案融入到 SDD 范式当中，加速 LLM 精确定位代码的时间、降低 token 消耗。在实际的 SDD 范式的测试过程中，我们发现 RAG 工具调用次数异常少，LLM 主要还是使用 grep/glob/bash tool 来召回。（事实上使用 grep/glob tool 检索代码的次数也非常少，主要是使用 bash tool，里面包裹着 grep/glob 命令。为什么？因为 bash shell 的功能足够强大，不同 shell 命令通过 pipe 可以完成多个任务的执行，效率更高）

**主要原因：RAG 工具的 prompt 是一种弱约束，在 long-running task 当中，LLM 注意力没法保证在代码召回阶段会优先使用 RAG 工具。**

开源社区有产品是利用 hook 来作为 LLM 调用 RAG 调用的强约束，例如 codebase-memory-mcp 通过 grep/glob hook 来注入 RAG 内容，但是这种强约束的效果有限：

* 在我们实际的测试过程中发现 long-running task 当中，LLM 往往更倾向使用 bash shell 取代 grep/glob 的调用，实际能被 hook 的次数并不多（例如上面通过 cspec 执行的长任务，0次 grep/glob 调用）；

由代码 RAG 在 long-running task 当中遇到的问题进而引申出在这种场景下，

1. 在 single Q&A benchmark 当中，基本每次 query 都可以
2. 在 long-running task 当中
