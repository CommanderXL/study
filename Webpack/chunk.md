## Chunk

一些概念及其相互之间的关系：

1. chunkGroup
2. chunk
3. module

我们都知道 webpack 打包构建时会根据你的具体业务代码和 webpack 相关配置来决定输出的最终文件，具体的文件的名和文件数量也与此相关。而这些文件就被称为 chunk。例如在你的业务当中使用了异步分包的 API：

```javascript
import('./foo.js').then(bar => bar())
```

在最终输出的文件当中，`foo.js`会被单独输出一个 chunk 文件。

又或者在你的 webpack 配置当中，进行了有关 optimization 优化 chunk 生成的配置：

```javascript
module.exports = {
  optimization: {
    runtimeChunk: {
      name: 'runtime-chunk'
    }
  }
}
```

最终 webpack 会将 webpack runtime chunk 单独抽离成一个 chunk 后再输出成一个名为`runtime-chunk.js`的文件。

而这些生成的 chunk 文件当中即是由相关的 module 模块所构成的。接下来我们就看下 webpack 在工作流当中是如何生成 chunk 的。

在 webpack 的工作流程当中，当所有的 module 都被编译完成后，进入到 seal 阶段会开始生成 chunk 的相关的工作。
