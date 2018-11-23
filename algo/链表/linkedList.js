class Node {
  constructor(element) {
    this.element = element
    this.next = null
    this.previous = null
  }
}

class LinkedList {
  constructor(element) {
    this.head = new Node(element)
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
      while(lastNode.next)
        lastNode = lastNode.next
      lastNode.next = newNode
      newNode.previous = lastNode
    } else {
      const _node = this.find(node)
      const _nextNode = _node.next
      newNode.next = _nextNode
      _nextNode && (_nextNode.previous = newNode)
      _node.next = newNode
      newNode.previous = _node
    }
  }

  display() {
    let curNode = this.head
    while(curNode) {
      console.log(curNode.element)
      curNode = curNode.next
    }
  }

  findPrevious(element) {
    let curNode = this.head
    while (curNode && curNode.next && curNode.next.element !== element) {
      curNode = curNode.next
    }
    return (curNode && curNode.next && (curNode.next.element === element)) ? curNode : null
  }

  findLast() {
    let curNode = this.head
    while(curNode && (curNode.next !== null)) {
      curNode = curNode.next
    }
    return curNode
  }

  remove(element) {
    let node = this.findPrevious(element)
    node && (node.next = node.next.next)
  }
}

const linkedList = new LinkedList('new LinkedList')
linkedList.insert('影魔')
linkedList.insert('幽鬼', '影魔')
linkedList.insert('SA', '影魔')
console.log(linkedList)
// linkedList.remove('SA')
// linkedList.display()
// const node = linkedList.findPrevious('dd')
// console.log(node)