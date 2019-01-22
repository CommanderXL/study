// 2个栈去实现队列
class Stack {
  constructor() {
    this.index = 0
    this.data = []
  }

  push(item) {
    this.data[this.index++] = item
  }

  pop() {
    if (this.index > 0) {
      return this.data[--this.index]
    }
  }

  peek() {
    return this.data[this.index - 1]
  }
}

class NewQueue {
  constructor() {
    this.s1 = new Stack()
    this.s2 = new Stack()
  }

  enqueue(item) {
    if (this.s1.length || (!this.s1.length && !this.s2.length)) {
      this.s1.push(item)
    } else {
      this.s2.push(item)
    }
  }

  dequeue() {
    if (this.s1.index) {
      while(this.s1.index > 0) {
        if (this.s1.index === 1) {
          return this.s1.pop()
        } else {
          this.s2.push(this.s1.pop())
        }
      }
    } else {
      while(this.s2.index > 0) {
        if (this.s2.index === 1) {
          return this.s2.pop()
        }
        this.s1.push(this.s2.pop())
      }
    }
  }
}


const queue = new NewQueue()
queue.enqueue(1)
queue.enqueue(2)
console.log(queue.dequeue())