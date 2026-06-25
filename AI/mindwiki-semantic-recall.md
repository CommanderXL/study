# MindWiki 业务语义召回机制

> 对话整理，2026-06-25

---

## 一、MindWiki 如何解决业务语义召回问题？

MindWiki 通过**多层递进**的方式解决业务语义召回问题：

### 1. 中文查询扩展（zh→en 映射）

`context` 命令内置 60+ 条中文→英文术语映射表，查询"鉴权"时会自动扩展为 `auth / authentication / authorization` 等英文标识符，解决业务用语与代码命名之间的语言鸿沟。

### 2. 标识符直接召回（`_symbol_name_direct_recall`）

在常规 FTS5 全文检索之外，并行执行一路专门针对符号名称的精确召回。能识别 `snake_case`、`_prefix`、`CamelCase`、`lowerCamelCase`、`ACRONYM+Camel`（如 `TFIDFIndex`）、`Class.method` 复合名等各种代码命名惯例，避免业务函数名被 BM25 打分淹没。

### 3. 混合检索（Hybrid Retrieval）

**FTS5（BM25）+ TF-IDF** 双路召回，自适应权重融合。可选 Ollama 语义向量（1024 维 dense embedding），优先级链为 `OllamaEmbeddingIndex → VecTFIDFIndex → TFIDFIndex`，向量路能跨越词汇 gap 命中语义相近但用词不同的代码。

### 4. 8 阶段 Context Pipeline（`context.py`）

```
hybrid recall（zh扩展 + 标识符直接召回）
  → source-type rerank（符号名/签名重叠 + body snippet 密度）
  → graph expansion（1-3 hop，推理类查询扩展到 3-hop，最多 10 块）
  → symbol deep enrich（callers/callees/inherits 2-hop 摘要）
  → iterative recall（迭代补充）
  → symbol expansion（sibling + 同文件 + sig/doc）
  → dedup + file/dir 多样性
  → char-budget fill
```

关键点：**graph expansion** 把召回问题从"词匹配"变成"依赖图遍历"——即使某个核心业务类的名字完全不含查询词，只要它被召回结果的邻居引用，就会被拉入上下文。

### 5. 领域术语抽取（`term_extractor.py`）

索引阶段从代码中抽取领域术语并建立映射，使后续查询能用业务语言（如"订单状态机"）命中代码中的技术实现（如 `OrderStateMachine`、`order_transition`）。

**本质思路**：MindWiki 不依赖单一召回信号，而是把**词汇匹配 + 标识符精确匹配 + 语义向量 + 依赖图遍历**四路信号融合，用图扩展弥补纯文本检索天然无法理解"这个函数的调用者也是相关上下文"的问题。

---

## 二、中文查询扩展 vs 领域术语抽取

两者解决的是不同层的问题。

### 中文查询扩展（`ZH_EN_TERM_MAP`，`_expand_query`）

**问题**：用户用中文问编程概念，但代码里是英文标识符——词汇 gap。

**实现**：[`embedding_conf.py`](../src/mindwiki/index/embedding_conf.py) 里是一张**静态、人工维护**的字典，覆盖 150+ 条编程通用术语：

```python
"调用": ["call", "invoke", "caller", "callee"],
"超时": ["timeout", "deadline"],
"鉴权": ["auth", "authentication", "authorization"],
```

查询时 `_expand_query` 对查询字符串做**最长匹配扫描**，把命中的中文词替换/追加为对应的英文词，同时送入 FTS5 和 TF-IDF 两条检索路径。

**关键设计**：这张表强调**语义等价而非项目实现名**——精度高，但只覆盖编程通用概念，对业务词无能为力（"防倒挂"、"完单率"不在表里）。

### 领域术语抽取（`term_extractor.py`，`extract_project_terms`）

**问题**：每个项目都有自己的业务词汇，没有任何通用字典能预先覆盖。

**实现**：**索引阶段**，从当前仓库的 symbols 表中读取所有函数名/类名（英文）和 docstring（含中文注释），通过**共现分析**自动提取：

```
符号: GetPassengerBasicFee  // "获取乘客基础费用"
↓ CamelCase 拆分 → ["passenger", "basic", "fee"]
↓ 中文 bigram PMI → ["乘客", "基础", "费用"]
↓ 位置对齐 + 拼音重叠评分
→ term_map: "乘客" → ["passenger"]
```

多信号融合评分（位置对齐 0.3 + 频率 0.4 + 拼音 Jaccard 0.2 + kind 0.1），跨符号出现次数不足会被过滤，结果持久化到 `term_map` 表，同时回写 `mindwiki/terms.json`。

### 两者的关系

```
全局 ZH_EN_TERM_MAP（静态，编程通用，高精度）
    ↓ 优先匹配，覆盖的位置不再被项目词典扫描
项目 term_map（动态，业务专属，自动提取）
    ↓ 仅补全全局未覆盖的词
→ _expand_query 合并两者输出扩展后的 token 序列
```

---

## 三、业务词（"防倒挂"、"完单率"）的完整处理流程

### 阶段一：索引时自动建立映射

`extract_project_terms` 在索引阶段扫描所有 symbols，寻找**英文函数名 + 中文 docstring 的共现**：

```python
def check_anti_price_reverse(...):
    """检查价格防倒挂逻辑"""
    ...
```

1. CamelCase/snake_case 拆分：`anti_price_reverse` → `["anti", "price", "reverse"]`
2. 从 docstring 提取中文 bigram（PMI 过滤高凝聚度词）：`["防倒", "倒挂", "价格"]`
3. 多信号融合评分：位置对齐 + 拼音 Jaccard + 跨符号共识频次
4. 写入 `term_map`：`"防倒挂" → ["anti_price_reverse"]`，并回写 `mindwiki/terms.json`

**可选 LLM 验证**：对置信度中间区间（score 0.3~1.0）的候选，用 LLM 判断保留/拒绝/补充，通过的条目 score ×2.0 并标记 `source='llm'`。

### 阶段二：查询时两路并发命中

查询"防倒挂相关逻辑"时：

**路径 A — `_expand_query` 扩展主查询**

主查询 token 序列被扩展为 `["防倒挂", "anti_price_reverse"]`，两个词同时进入 FTS5 和 TF-IDF，能命中注释、签名、body 里的任何一处。

**路径 B — `_term_targeted_recall` 精准补召（并发启动）**

专门解决**扩展后 token 太多、精确符号名被稀释出 top-60** 的问题：

```
从查询中扫描到 "防倒挂" → 映射 → "anti_price_reverse"
→ 单独用 "anti_price_reverse" 做 hybrid_search(top_k=2, expand_query=False)
→ 结果以衰减分数合并进主路 hits
```

两路结果在收割时统一按 `chunk_id` 去重合并，再经 reranker → graph expand → symbol enrich 后输出。

### 兜底：手工维护 terms.json

如果项目注释不完善，自动提取可能覆盖不到。可手工编辑 `mindwiki/terms.json`：

```json
{
  "防倒挂": ["anti_price_reverse", "price_limit"],
  "完单率": ["closing_rate", "completion_rate"]
}
```

`load_local_terms` 查询时优先加载此文件，且 `_merge_terms_to_json` 重建时会保留 `manual/llm` 标记的条目，不被覆盖。
