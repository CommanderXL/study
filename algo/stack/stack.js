class Stack {
  constructor() {
    this.index = 0
    this.data = []
  }

  push(ele) {
    this.data[this.index++] = ele
  }

  pop() {
    if (this.index === 0) return
    return this.data[this.index--]
  }

  peek() {
    return this.data[this.index - 1]
  }
}

// 课后习题 4-4
function fn4() {
  let str = '2.3 + 23 / 12 + (3.14159 x 0.24'
  let i = 0
  let s1 = new Stack()
  let s2 = new Stack()
  let pushBra = new Set(['(', '[', '{'])
  let popBra = new Set([')', ']', '}'])
  for (; i < str.length; i++) {
    let item = str[i]
    if (pushBra.has(item)) {
      s1.push(item)
      s2.push(i)
    }
    if (popBra.has(item)) {
      if (isOk(s1.pop()), item) {
        s2.pop()
        continue
      } else {
        return s2.pop()
      }
    }
  }
  if (s1.index > 0) {
    return s2.peek()
  }

  function isOk(l, r) {
    if (l === '(' && r === ')') {
      return true
    } else if (l === '{' && r === '}') {
      return true
    } else if (l === '[' && r === ']') {
      return true
    }
    return false
  }
}

console.log(fn4())
