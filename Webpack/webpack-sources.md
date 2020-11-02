## Webpack-sources

### RawSource

字符串类型的 source，`rawSource.source()` 即可获取对应的字符串。

```javascript
class RawSource extends Source {
  constructor(value) {
    super()
    this._value = value
  }

  source() {
    return this._value
  }

  ...
  
  updateHash(hash) {
    hash.update(this._value)
  }
}
```

### ReplaceSource

```javascript
class Replacement {
  constructor(start, end, content, insertIndex, name) {
    this.start = start
    this.end = end
    this.content = content
    this.insertIndex = insertIndex
    this.name = name
  }
}

class ReplaceSource extends Source {
  constructor(source, name) {
    super()
    this._source = source
    this._name = name
    this.replacements = []
  }

  // 注意这里排序的策略：由后向前
  /*
  
  1. end 靠后的，替换时序的优先级更高
  2. start 靠后的，替换时序的优先级更高
  3. insertIndex 越大的，替换时序优先级更高
  
  */
  _sortReplacements() {
    this.replacements.sort(function(a, b) {
      var diff = b.end - a.end
      if (diff !== 0) {
        return diff
      }
      diff = b.start - a.start
      if (diff !== 0) {
        return diff
      }
      return b.insertIndex - a.insertIndex
    })
  }

  _replaceString(str) {
    // 首先对于需要替换的 replacements 进行优先级的排序
    this._sortReplacements()
    var result = [str]
    // 遍历 replacements，对字符串进行切割处理，并最终按：[start, content, end] 的形式组合
    this.replacements.forEach(function(repl) {
      var remSource = result.pop()
      var splitted1 = this._spiltString(remSource, Math.floor(repl.end + 1))
      var splitted2 = this._spiltString(splitted1[0], Math.floor(repl.start))
      result.push(splitted1[1], repl.content, splitted2[0])
    }, this)

    // 这里主要是因为在 this._sortReplacements() 方法的时候，是将 end / start / insertIndex 较大的排在前面，
		// 因此在 this.replacements.forEach 方法对源码进行切割的时候，是从源码从后向前进行切割的。
		// 所以在接下来的代码拼接的环节，需要从后向前遍历
		// write out result array in reverse order
    let resultStr = ''
    for (let i = result.length; i >= 0; i--) {
      resultStr += result[i]
    }
    return resultStr
  }

  _spiltString(str, position) {
    return position <= 0 ? ['', str] : [str.substr(0, position), str.substr(position)]
  }
}
```