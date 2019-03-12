function swap(arr = [], n1, n2) {
  if (!arr.length) return
  let tmp = arr[n2]
  arr[n2] = arr[n1]
  arr[n1] = tmp
}

const arr = [0, 7, 5, 19, 8, 4, 1, 20, 13, 16]

/**
 * heap sort
 * 
 * 1. 首先完成建堆的过程(堆化)
 * 2. 借助删除堆顶元素的算法去完成排序的过程
 * 
 */

function buildHeap(arr = []) {
  let max = Math.floor(arr.length - 1 / 2) 
  for (let i = max; i >= 1; --i) {
    heapify(arr, max, i)
  }

  heapSort(arr)

  console.log(arr)
}

function heapify(arr, max, index) {
  while (true) {
    let maxPos = index // 暂存最大数据位置
    if (2 * index <= max && arr[index] < arr[2 * index]) maxPos = 2 * index // 如果小于左子节点的位置，那么进行替换
    if (2 * index + 1 <= max && arr[maxPos] < arr[2 * index + 1]) maxPos = 2 * index + 1 // 如果小于右子节点的位置，那么进行替换
    if (maxPos === index) break
    swap(arr, index, maxPos)
    index = maxPos
  }
}

// 一直进行删除堆顶的操作，即每次都将堆顶最大数取下来放置数组最后，这样就完成了排序的过程
function heapSort(arr = []) {
  let index = arr.length - 1
  while (index > 1) {
    swap(arr, 1, index)
    --index
    heapify(arr, index, 1)
  }
}

buildHeap(arr)