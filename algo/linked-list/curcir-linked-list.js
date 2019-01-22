class Node {
  constructor(element) {
    this.element = element
    this.next = null
  }
}

class LinkedList {
  constructor(element) {
    this.head = new Node(element)
    this.current = this.head
    this.length = 1
  }

  find(element) {
    let curNode = this.head
    while (curNode && (curNode.element !== element)) {
      curNode = curNode.next
    }
    return (curNode && (curNode.element === element)) ? curNode : null
  }

  insert(newElement, node) {
    const newNode = new Node(newElement)
    if (!node) {
      let lastNode = this.head
      while(lastNode.next && lastNode.next !== this.head) {
        lastNode = lastNode.next
      }
      lastNode.next = newNode
      newNode.next = this.head
      // newNode.previous = lastNode
    } else {
      const _node = this.find(node)
      const _nextNode = _node.next
      newNode.next = _nextNode
      // _nextNode && (_nextNode.previous = newNode)
      _node.next = newNode
      // newNode.previous = _node
    }
    ++this.length 
  }

  display() {
    let curNode = this.head
    while(curNode) {
      curNode = curNode.next
      if (curNode === this.head)
        break
    }
  }

  findPrevious(element) {
    let curNode = this.head
    while (curNode && curNode.next && curNode.next.element !== element) {
      curNode = curNode.next
      if (curNode === this.head)
        break
    }
    return (curNode && curNode.next && (curNode.next.element === element)) ? curNode : null
  }

  remove(element) {
    let node = this.findPrevious(element)
    node && (node.next = node.next.next)
    --this.length
  }

  next() {
    this.current = this.current.next
    return this.current
  }
}

const linkedList = new LinkedList(1)
for(let i = 2; i <= 10; i++) {
  linkedList.insert(i)
}

function killNumThird() {
  if (linkedList.length < 3) {
    return
  }
  let index = 2
  while(index--) {
    let node = linkedList.next()
    if (!index) {
      if (node.element === linkedList.head.element) {
        linkedList.head = node.next
      }
      linkedList.next()
      linkedList.remove(node.element) 
      killNumThird()
    }
  }
}

killNumThird()
linkedList.display()