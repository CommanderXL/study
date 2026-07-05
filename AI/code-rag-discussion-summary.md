# 代码 RAG 与 Embedding 召回讨论总结

## 1. 业内代码 RAG 的主要方案

代码 RAG 不是单一技术，而是一组检索、结构分析和推理能力的组合。业内常见方案大致包括：

- IDE 内置代码库索引：Cursor、Windsurf、GitHub Copilot 等。
- 企业级代码搜索和 AI：Sourcegraph Cody、Sourcegraph Code Search 等。
- 开源或可自托管助手：Continue、aider 等。
- 企业私有上下文引擎：Tabnine、Qodo 等。
- 平台型 AI 开发助手：GitHub Copilot Enterprise、GitLab Duo、Amazon Q Developer 等。
- 研究和自研方向：Code Graph RAG、AST RAG、调用图检索、Repo-level retrieval 等。

主流趋势是从单纯的向量检索升级为：

```text
向量检索
+ 关键词/BM25
+ 符号索引
+ AST/LSP
+ 调用图/依赖图
+ rerank
+ agentic traversal
```

也就是说，真实系统越来越不像传统 RAG，而更像一个会反复搜索、读代码、追调用链、组织上下文的代码 agent。

## 2. Embedding 模型本身的能力边界

Embedding 模型本身解决的是表示问题：把自然语言、代码、注释、文件路径、错误信息等输入编码成向量，让系统可以用相似度计算它们在语义上的接近程度。

它主要处理的是：

```text
自然语言意图 <-> 代码表征
```

它可以帮助系统把用户描述的问题和代码中的英文命名、符号、注释、路径、错误信息等对齐。

例如用户问：

```text
用户退出后为什么还保持登录状态？
```

代码里可能没有这些中文词，但可能有：

```text
logout()
clearSession()
isAuthenticated
tokenStorage
removeAccessToken
```

如果 embedding 模型训练得好，它可以把这些内容放到相近的语义空间中，从而找到一批候选入口。

这里要区分两个层次：

```text
Embedding 模型能力：
  一个输入能否被编码成有意义的语义向量。

代码语义召回效果：
  用这个向量在真实代码库里检索时，能否找全、找准相关代码。
```

这两个不是一回事。

Embedding 模型能力偏向回答：

- 中文“登录”能否和英文 `login`、`signIn`、`auth` 靠近。
- 中文“刷新 token”能否和 `refreshToken`、`renewAccessToken` 靠近。
- “用户保持登录状态”能否和 `isAuthenticated`、`session`、`tokenStorage` 靠近。
- `parseUser`、`normalizeUserProfile`、`UserParser` 是否在语义上相关。

但 embedding 模型本身不负责回答：

- 谁调用了谁？
- 某个分支什么时候执行？
- 配置从哪里来？
- 字段在哪里被改写？
- 改一处会影响哪些路径？
- 多文件之间的因果关系是什么？

这些属于程序结构、运行路径和因果关系问题，需要 AST、LSP、调用图、依赖图、测试和 agentic traversal 参与。

所以，embedding 模型的能力边界可以概括为：

```text
它能做语义对齐和相似度估计。
它不能单独完成代码理解、链路分析和根因定位。
```

## 3. 通过语义召回代码的效果边界

通过 embedding 做代码语义召回，是一个检索系统问题，不只是模型问题。

即使 embedding 模型本身具备跨语言语义对齐能力，真实召回效果仍然取决于：

- 代码如何切 chunk。
- chunk 是按文件、类、函数还是语义块切分。
- 是否给函数、类、文件生成摘要。
- query rewrite 是否保留原始问题。
- 是否同时使用关键词、符号和路径检索。
- Top-K 设多大。
- 是否有 rerank。
- 是否会沿调用链和引用关系继续扩展。

因此，两个系统使用同一个 embedding 模型，召回效果也可能完全不同。

例如：

```text
系统 A：
  200 行函数整体 embedding
  短 query embedding
  直接 cosine Top-K

系统 B：
  函数级 embedding
  语义块 embedding
  函数摘要 embedding
  原始 query + 扩写 query
  BM25 + symbol search + rerank
  调用链扩展
```

这两个系统的 embedding 模型能力可能一样，但代码召回效果会有明显差异。

所以需要把结论拆开看：

```text
Embedding 能力边界：
  模型是否能把自然语言和代码概念映射到相近向量。

语义召回效果边界：
  检索系统能否在真实代码库中把相关代码找全、找准、排到前面。
```

前者是模型表示能力，后者是工程系统能力。

## 4. 为什么短 query 匹配长代码 chunk 效果不一定好

如果用户 query 很短，例如：

```text
parseUser 解析用户
```

它的 embedding 表达的是一个比较集中的意图：

```text
解析用户
parse user
把输入转换成 User 对象
用户字段提取和校验
```

但一个长代码 chunk 可能同时包含：

```text
JSON.parse
字段校验
profile normalization
permission loading
audit
logging
error handling
return object
```

因此，长 chunk 的向量不是单纯的“parse user”，而是很多语义的混合体。

可以粗略理解为：

```text
query 向量：
  90% parse user

chunk 向量：
  25% parse user
  20% validation
  15% permissions
  15% logging
  15% profile normalization
  10% error handling
```

这会导致一个问题：即使 chunk 里确实包含用户要找的逻辑，整体 embedding 也可能被其他内容拉偏，最终和短 query 的余弦相似度不够高。

这就是所谓的语义稀释。

更准确地说：

```text
短 query 表达的是意图/概念
长 chunk 表达的是内容分布
```

两者都在同一个向量空间里，但语义密度和表达粒度不同，所以相似度分数不一定能真实反映“这个 chunk 是否能回答用户问题”。

## 5. 为什么单靠 embedding 不能召回完整代码上下文

真实代码问题往往不是片段级问题，而是任务级或链路级问题。

例如：

```text
登录失败时为什么没有刷新 token？
```

答案可能分散在多个文件中：

```text
frontend/login.tsx
api/auth/login.ts
services/AuthService.ts
services/TokenService.ts
middleware/session.ts
http/interceptors.ts
config/auth.ts
tests/auth.spec.ts
```

其中有些文件甚至不包含 `refresh token` 关键词，但它们控制了流程分支或错误处理逻辑。

所以成熟系统通常不会指望一次 embedding Top-K 召回所有内容，而是采用迭代式检索：

```text
1. 先用 query 找入口点
2. 读取入口文件
3. 识别关键符号
4. 沿定义、引用、调用方、被调用方继续扩展
5. 查 import/export、配置、测试、错误处理
6. 判断上下文是否足够
7. 不够则继续检索
8. 最后压缩成可用上下文交给 LLM
```

因此，embedding 的合理定位是：

```text
找入口
补召回
生成候选
```

而不是：

```text
一次性找出所有必要代码
准确理解完整调用链
判断根因和影响面
```

## 6. Query rewrite 不应该只输出短关键词

如果用户问题是：

```text
登录失败时为什么没有刷新 token？
```

错误的做法是只把它改写成：

```text
login
failure
refresh token
session
```

这些短关键词信息量太低，不适合作为唯一召回输入，尤其不适合单独用于 dense embedding 检索。

更合理的是让 query rewrite 输出多种查询形态：

```json
{
  "semantic_queries": [
    "why login failure does not refresh the access token",
    "authentication failure should trigger token refresh but does not"
  ],
  "keywords": [
    "login",
    "failure",
    "refresh",
    "token",
    "session",
    "401",
    "Unauthorized"
  ],
  "symbols": [
    "login",
    "refreshToken",
    "accessToken",
    "AuthService",
    "TokenService"
  ],
  "path_hints": [
    "auth",
    "login",
    "session",
    "token"
  ],
  "sub_questions": [
    "Where is login failure handled?",
    "Where is token refresh triggered?",
    "Does 401 handling call refreshToken?"
  ]
}
```

不同字段应该进入不同检索器：

```text
semantic_queries -> vector search
keywords         -> BM25 / grep / ripgrep
symbols          -> AST / LSP / symbol index
path_hints       -> filename / path search
sub_questions    -> agentic exploration
```

也就是说，同一个用户问题不应该被压缩成一组短关键词，而应该被转换成多种适合不同检索系统使用的查询。

## 7. 为什么不能完全相信 LLM 生成的 query rewrite

Query rewrite 通常由 LLM 完成，但如果让 LLM 自由改写，系统并不知道它到底会把原始问题改成什么，也无法保证它不会漏掉关键概念。

因此生产系统里通常要让 LLM 按固定 schema 输出，而不是自由生成文本。

同时，还要有非 LLM 的保底策略：

```text
原始 query 永远保留
规则抽取关键词
中英文词典扩展
业务术语映射
驼峰/蛇形/短横线命名变体
历史成功 query 模板
```

最终查询集合应该是：

```text
final_queries =
  原始用户问题
  + LLM 结构化 rewrite
  + 规则抽取结果
  + 领域词典扩展
  + 命名变体扩展
```

关键原则是：

```text
rewrite 是增强，不是替代
```

错误设计：

```text
用户问题
  -> LLM rewrite 成几个词
  -> 只用这几个词召回
```

更好的设计：

```text
用户问题
  -> 保留原始 query
  -> LLM 结构化改写
  -> 规则补充
  -> 多路检索
  -> 合并去重
  -> rerank
  -> 必要时继续探索
```

## 8. 实际工程中的推荐召回流程

一个更稳的代码 RAG 召回流程可以设计为：

```text
用户问题
  -> query understanding
  -> structured query rewrite
  -> 原始 query 语义召回
  -> semantic_queries 向量召回
  -> keywords 走 BM25/grep
  -> symbols 走 AST/LSP/symbol index
  -> path_hints 走路径搜索
  -> 合并候选
  -> 去重
  -> rerank
  -> 读取高价值文件/函数
  -> 沿调用链和引用关系扩展
  -> 上下文压缩
  -> 交给 LLM 回答或执行代码修改
```

这里的核心思想是：

```text
用 embedding 找语义入口
用关键词保证精确命中
用符号索引保证程序结构
用 rerank 提升相关性排序
用 agentic traversal 补齐多跳上下文
```

## 9. 分层后的最终判断

需要把 embedding 模型能力和代码语义召回效果分开判断。

Embedding 模型本身适合：

- 自然语言到代码概念的粗匹配。
- 中文问题到英文代码命名的语义对齐。
- 同义表达、业务概念、代码标识符之间的相似度估计。
- 为候选生成提供语义信号。

Embedding 模型本身不适合单独承担：

- 程序结构理解。
- 调用链分析。
- 运行时行为判断。
- 跨文件因果推理。

通过 embedding 做代码语义召回适合：

- 找到可能相关的入口文件或函数。
- 在关键词不完全匹配时补召回。
- 作为多路召回中的一路候选来源。
- 为后续 rerank 和 agent 探索提供起点。

通过 embedding 做代码语义召回不适合单独承担：

- 找全所有相关文件。
- 找准完整调用链。
- 独立完成跨文件根因定位。
- 独立完成影响面分析。
- 精确找出所有必要上下文。

因此，更准确的定位是：

```text
embedding = 候选生成器 / 语义入口
keyword search = 精确命中
symbol search = 程序结构事实
reranker = 候选排序
agent = 迭代探索和上下文组织
```

最终结论：

```text
纯 embedding RAG 在代码场景里通常不够。
靠谱的代码 RAG 需要多路召回、结构索引、重排序和迭代式探索。
```
