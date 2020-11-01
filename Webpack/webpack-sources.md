## Webpack-sources

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

  }
}
```