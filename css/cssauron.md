核心是将 css selector 的匹配规则使用场景范围扩大，使得原本使用于 DOM 节点的匹配，拓展为对于 vDom Tree，json 嵌套数据结构、[js AST](https://github.com/chrisdickinson/cssauron-falafel#readme)等数据结构的匹配。

在核心的处理流程当中主要包含了

* parse 对于 css selector 序列化的处理，产出匹配规则；
* match 对于给定的输入数据结构，使用在 parse 阶段解析出来的匹配规则去获取最终的结果；

### Parse 阶段

首先对于 css selector 规则做枚举，这里可以看出枚举的规则并不是很多：

```javascript
var PSEUDOSTART = 'pseudo-start', // 
  ATTR_START = 'attr-start', // [
  ANY_CHILD = 'any-child', // 
  ATTR_COMP = 'attr-comp', // 属性匹配规则
  ATTR_END = 'attr-end', // ]
  PSEUDOPSEUDO = '::', // 伪元素
  PSEUDOCLASS = ':', // 伪类
  READY = '(ready)', // 重置标志位
  OPERATION = 'op', // >、+、~ 获取节点之间的关系
  CLASS = 'class',
  COMMA = 'comma',
  ATTR = 'attr',
  SUBJECT = '!', // css 规范里面已经剔除了这项规则
  TAG = 'tag',
  STAR = '*',
  ID = 'id'
```

进入到 parse 阶段，通过：

* state 唯一变量去管理目前解析的阶段/状态，不同的阶段对应着不同解析规则；
* idx 索引的标志位；

```javascript
function ondata(chunk) {
  data = data.concat(chunk.split(''))
  length = data.length

  while (idx < length && (c = data[idx++])) {
    switch (state) { // 依据目前的 state 状态来决定匹配的规则策略
      case READY:
        state_ready()
        break
      case ANY_CHILD:
        state_any_child()
        break
      case OPERATION:
        state_op()
        break
      case ATTR_START:
        state_attr_start()
        break
      case ATTR_COMP:
        state_attr_compare()
        break
      case ATTR_END:
        state_attr_end()
        break
      case PSEUDOCLASS:
      case PSEUDOPSEUDO:
        state_pseudo()
        break
      case PSEUDOSTART:
        state_pseudostart()
        break
      case ID:
      case TAG:
      case CLASS:
        state_gather()
        break
    }
  }

  data = data.slice(idx)

  if (gathered.length) {
    stream.queue(token())
  }
}

// state 匹配规则，依据 css selector 的规则
function state_ready() {
  switch (true) {
    case '#' === c:
      state = ID
      break
    case '.' === c:
      state = CLASS
      break
    case ':' === c:
      state = PSEUDOCLASS
      break
    case '[' === c:
      state = ATTR_START
      break
    case '!' === c:
      subject()
      break
    case '*' === c:
      star()
      break
    case ',' === c:
      comma()
      break
    case /[>\+~]/.test(c):
      state = OPERATION
      break
    case /\s/.test(c):
      state = ANY_CHILD
      break
    case /[\w\d\-_]/.test(c):
      state = TAG
      --idx
      break
  }
}

function state_any_child() {
  if (/\s/.test(c)) {
    return
  }

  if (/[>\+~]/.test(c)) {
    return --idx, (state = OPERATION)
  }

  // 生成 any_child 节点，并重置状态
  stream.queue(token())
  state = READY
  --idx
}

function state_gather(quietly) {
  // 如果是非单词字符，例如 空格。会更新 state 的状态
  // 对于 css selector 规则而言，空格也意味着需要切换到一条新的匹配规则里面去
  if (/[^\d\w\-_]/.test(c) && !escaped) {
    if (c === '\\') {
      escaped = true
    } else {
      !quietly && stream.queue(token()) // 消费匹配到的数据，并将 state 状态进行重置，更新索引值
      state = READY
      --idx
    }

    return
  }

  escaped = false
  gathered.push(c)
}

// 消费匹配到的内容，state + 实际匹配数据
function token() {
  var data = gathered.join('')

  gathered.length = 0

  return {
    type: state,
    data: data
  }
}
```