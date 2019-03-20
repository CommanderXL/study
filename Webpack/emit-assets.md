## 文件输出

当所有的 moduleId 和 chunkId 都分配完之后，调用 createChunkAssets 方法来决定最终输出到每个 chunk 当中对应的文本内容是什么。

在 createChunkAssets 方法内部会对最终需要输出的 chunk 进行遍历，根据这个 chunk 是否包含有 webpack runtime 代码来决定使用的渲染模板。那我们首先来看下包含有 webpack runtime 代码的 chunk 是如何输出最终的 chunk 文本内容的。

