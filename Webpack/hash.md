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
    const hash = createHash(hashFunction); // 本次 compilation 所使用的 hash
    
    const chunks = this.chunks.slice();
    
    ...

    // 遍历最终需要生成的 chunks
		for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // 为每个 chunk 新生成一个 chunkHash 生成函数
			const chunkHash = createHash(hashFunction);
			try {
				if (outputOptions.hashSalt) {
					chunkHash.update(outputOptions.hashSalt);
				}
				chunk.updateHash(chunkHash);
				const template = chunk.hasRuntime()
					? this.mainTemplate
					: this.chunkTemplate;
				template.updateHashForChunk(
					chunkHash,
					chunk,
					this.moduleTemplates.javascript,
					this.dependencyTemplates
				);
				// chunkhash 生成完毕
				this.hooks.chunkHash.call(chunk, chunkHash);
				chunk.hash = chunkHash.digest(hashDigest);
				hash.update(chunk.hash);
				chunk.renderedHash = chunk.hash.substr(0, hashDigestLength);
				this.hooks.contentHash.call(chunk);
			} catch (err) {
				this.errors.push(new ChunkRenderError(chunk, "", err));
			}
    }
    
    ...
  }
}
```

遍历最终需要生成的 chunks，为每个 chunk 新生成一个 chunkHash 生成函数。调用 `chunk.updateHash` 方法:

```javascript
class Chunk {
  ...
  updateHash() {
    hash.update(`${this.id} `);
		hash.update(this.ids ? this.ids.join(",") : "");
		hash.update(`${this.name || ""} `);
		for (const m of this._modules) {
			hash.update(m.hash);
		}
  }
  ...
}
```

对这个 chunk 的 id / ids / name 以及这个 chunk 所包含的所有的 module 的 hash(chunk生成 hash 之前就已经生成好的) 进行 hash 计算。这个过程进行完后，根据这个 chunk 是否是入口 chunk 来调用对应的 updateHashForChunk 方法。这个方法结束后会暴露出一个 chunkHash 的钩子函数，并生成最终属于这个 chunk 的 hash 值。