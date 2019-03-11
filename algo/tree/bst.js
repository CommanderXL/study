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
    // 1 找到符合条件的节点
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

// 1.1 计算一个二叉树的层数
// 递归版本抽象：取某个节点，取这个节点的左子树和右子树的最大高度，再加1，即为这个节点的高度

function calBSTHeight1(node) {
  if (node) {
    return Math.max(calBSTHeight1(node.left), calBSTHeight1(node.right)) + 1
  }
  return 0
}

console.log(calBSTHeight1(bst.root))

// 1.2 计算一个二叉树的层数
// 非递归版本抽象：从 root 节点开始遍历，每遍历一层，层数+1
// 同时计算每一层节点的数量，直到遇到某一层节点数量为0的时候，即可判断已经为BST最底层的节点了

function calBSTHeight2(node) {
  let nodeArr = []
  nodeArr.push(node.root)
  let height = 1
  while(nodeArr.length > 0) {
    let len = nodeArr.length
    let index = 0

    ++height

    while (index < len) {
      const _node = nodeArr[index]
      if (_node.left) {
        nodeArr.push(_node.left)
      }
      if (_node.right) {
        nodeArr.push(_node.right)
      }
      ++index
      nodeArr.shift()
    }
  }

  return height
}

console.log(calBSTHeight2(bst))

// 2. 计算某个给定的BST节点的所处的高度