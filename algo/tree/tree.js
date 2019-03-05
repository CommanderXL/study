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

  del(ele) {
    let node = this.root
    let parent
    while (node && node.ele !== ele) {
      parent = node
      if (node.ele < ele) node = node.right
      else node = node.left
    }

    if (node === null) return

    // 2.1 判断被删除的节点类型：有2个子节点
    if (node.left && node.right) {
      let _node = node.right
      let _parent
      while (_node) {
        if (_node.left) {
          _parent = _node
          _node = _node.left
        }
      }
      node.data = _node.data
      node = _node
      parent = _parent
    }

    // 2.2 判断被删除的节点的类型： 只有一个节点 或者 为叶子节点的情况
    let child
    if (node.left) child = node.left
    else if (node.right) child = node.right
    else child = null

    // 3 判断被删除的节点和其父节点之间的关系，并做替换操作
    if (!parent) this.root = null
    else if (parent.left === node) parent.left = child
    else parent.right = child

  }
}

const bst = new BinarySearchTree()
const arr = [10, 9, 11, 24, 8, 78, 22]
for (let i = 0; i < arr.length; i++) {
  bst.insert(arr[i])
}

console.log(bst.find(11))