// TODO:
// 1. 单链表的反转(reverse)
// 2. 链表中环的检测(判断是否为循环链接)
// 3. 2个有序链表的合并
// 4. 删除链表倒数第n个节点
// 5. 求链表的中间节点

class Node {
  constructor(element) {
    this.element = element
    this.next = null
  }
}

class LinkedList {
  constructor(element) {
    this.head = new Node(element)
  }

  find(element) {
    let _node = this.head
    while(_node && (_node.element !== element)) {
      _node = _node.next
    }
    return _node
  }

  insert(element, targetElement) {
    let node = new Node(element)
    let _node = this.head
    if (targetElement) {
      let targetNode = this.findPrevious(targetElement)
      if (targetNode) {
        let oldNextNode = targetNode.next
        node.next = oldNextNode
        targetNode.next = node
      }
    } else {
      while(_node.next) {
        _node = _node.next
      }
      _node.next = node
    }
  }

  findPrevious(element) {
    let node = this.head
    while(node && node.next && (node.next.element !== element)) {
      node = node.next
    }

    return node
  }

  remove(element) {
    let node = this.findPrevious(element)
    if (node) {
      node.next = node.next.next
    }
  }

  display() {
    let node = this.head
    while(node) {
      console.log(node.element)
      node = node.next
    }
  }

  // 链表反转
  reverse() {
    let node = this.head
    let nNode = null
    let lNode = null
    let nnNode = null
    while(node && node.next) {
      nNode = node.next
      nnNode = node.next.next
      if (lNode) {
        node.next = lNode
      } else {
        nNode.next = node
        node.next = null
      }
      lNode = nNode
      node = nnNode
      if (!nNode) {
        node.next = lNode
        break
      } else if (!!nnNode) {
        nNode.next = node
        this.head = nNode
        return
      }
    }
    this.head = node
  }

  // 寻找中间值
  findMiddleNode() {
    let fast = this.head
    let slow = this.head
    while (fast.next && fast.next.next) {
      // 快节点每次要比慢节点多移动一位
      fast = fast.next.next
      slow = slow.next
    }
    return slow
  }

  // 检测是否有环
  checkCircle() {
    let fast = this.head.next
    let slow = this.head
    while(fast && fast.next) {
      fast = fast.next.next
      slow = slow.next
      if (fast === slow) 
        return true
    }
    return false
  }
}

let ll = new LinkedList(1)
for (let i = 2; i <= 40; i++) {
  ll.insert(i)
}
console.log(ll.findMiddleNode())
// console.log(ll)


// const linkedList = new LinkedList('Roshan')
// linkedList.insert('影魔')
// linkedList.insert('幽鬼', '影魔')
// // linkedList.insert('SA', '影魔')
// linkedList.reverse()
// console.log(linkedList)
// linkedList.display()
// // linkedList.display()