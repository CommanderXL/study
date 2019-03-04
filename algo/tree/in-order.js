const tree = require('./tree')

function inOrderBinarySearch(node) {
  if (!node) return
  if (node.left) {
    inOrderBinarySearch(node.left)
  }
  node.ele && console.log(node.ele)
  if (node.right) {
    inOrderBinarySearch(node.right)
  }
}

inOrderBinarySearch(tree)