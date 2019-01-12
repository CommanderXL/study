## hash 生成规则

hash 的生成过程是在 seal 阶段，当 chunk 和 module 建立起联系，module 被分配完 id 后开始进行。对应于 compilation 实例上的 createHash 方法：

最终生成的 hash 又分为好几种，例如代表本次 compilation 编译的 hash，每个 chunk 的 hash，每个 module 的 hash。所生成的这些 hash 主要都是基于文本实际内容去生成的。这里我们主要来看下平时用的较多的 chunkHash 是如何生成的。由于在 hash 生成的过程中会有很多相关的文本去影响最终的 hash 生成，这里主要是看下一些比较关键的影响 hash 生成的内容。

```javascript
class Compilation {
  createHash() {
    const outputOptions = this.outputOptions; // output 配置
		const hashFunction = outputOptions.hashFunction; // 所使用的 hash 函数，默认为 md5
		const hashDigest = outputOptions.hashDigest; // 生成 hash 所使用的编码方法，默认为 hex
		const hashDigestLength = outputOptions.hashDigestLength; // 最终输出的文件所使用的 hash 长度
		const hash = createHash(hashFunction);
  }
}
```