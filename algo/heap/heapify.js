function swap(arr, index1, index2) {
  let tmp = arr[index1]
  arr[index1] = arr[index2]
  arr[index2] = tmp
}

// 大顶堆
const arr = [0, 33, 17, 21, 16, 13, 15, 9, 5, 6, 7, 8, 1, 2]

// 插入数据
// 由下向上进行堆化
function heapifyFromBottom(arr = [], num) {
  arr.push(num)
  let index = Math.floor((arr.length - 1) / 2)
  let _index = arr.length - 1
  // let _index = Math.floor(_index / 2)
  while (arr[index] < num) {
    swap(arr, index, _index)

    _index = index
    index = Math.floor(index / 2)
  }
  console.log(arr)
}

heapifyFromBottom(arr, 22)
// console.log(arr)

// 删除堆顶数据(注意循环的退出条件)
// 由上向下进行堆化
function heapifyFromTop() {
  let lastNum = arr[arr.length - 1]
  let maxLen = arr.length - 2
  arr[1] = lastNum
  arr.pop()
  let i = 1
  let maxPos
  while (true) {
    if (2 * i <= maxLen && arr[i] < arr[2 * i]) maxPos = 2 * i
    if (2 * i + 1 <= maxLen && arr[maxPos] < arr[2 * i + 1]) maxPos = 2 * i + 1
    if (maxPos === i) break // 退出循环的条件就是，maxPos 和 i 相等，即到达树的叶子节点的地方
    swap(arr, i, maxPos)
    i = maxPos
  }
}

// heapifyFromTop()
// console.log(arr)