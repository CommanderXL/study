const tree = require('./tree')
// 后序遍历
function postOrderBinarySearch(node) {
  if (!node) return
  if (node.left) {
    postOrderBinarySearch(node.left)
  }
  if (node.right) {
    postOrderBinarySearch(node.right)
  }
  node.ele && console.log(node.ele)
}

postOrderBinarySearch(tree)