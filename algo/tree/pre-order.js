const tree = require('./pre-order')
// 前序遍历
function preOrderBinarySearch(node) {
  node.ele && console.log(node.ele)
  if (node.left) {
    preOrderBinarySearch(node.left)
  }
  if (node.right) {
    preOrderBinarySearch(node.right)
  }
}

preOrderBinarySearch(tree)