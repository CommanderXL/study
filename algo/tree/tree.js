// 链式存储方式
const tree = {
  ele: 10,
  left: {
    ele: 9,
    left: {
      ele: 7
    },
    right: {
      ele: 6
    }
  },
  right: {
    ele: 8,
    left: {
      ele: 5
    },
    right: {
      ele: 4
    }
  }
}

module.exports = tree

class Node {
  constructor(ele) {
    this.ele = ele
    this.left = null
    this.right = null
  }
}

class BinarySearchTree {
  constructor() {
    this.root = null
  }
  
  find(ele) {
    let node = this.root
    if (!node) {
      return
    }
    while(node) {
      if (node.ele === ele) {
        return node
      } else if (node.ele < ele) {
        node = node.right
        if (!node) {
          return
        }
      } else {
        node = node.left
        if (!node) {
          return
        }
      }
    }
  }

  insert(ele) {
    const newNode = new Node(ele)
    if (!this.root) {
      this.root = newNode
    } else {
      let node = this.root
      while(node) {
        if (node.ele > ele) {
          if (!node.left) {
            node.left = newNode
            return
          }
          node = node.left
        } else if (node.ele < ele) {
          if (!node.right) {
            node.right = newNode
            return
          }
          node = node.right
        }
      }
    }
  }

  del() {

  }
}

const bst = new BinarySearchTree()
const arr = [10, 9, 11, 24, 8, 78, 22]
for (let i = 0; i < arr.length; i++) {
  bst.insert(arr[i])
}

console.log(bst.find(11))